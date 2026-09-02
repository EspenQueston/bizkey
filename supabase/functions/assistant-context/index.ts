import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tool endpoint for n8n's AI Agent node (an HTTP Request Tool). Today the
// agent has zero access to BizKey's own data — whatsapp-sync only mirrors
// messages after the fact, it never feeds anything back into what the agent
// says. This closes that gap: given the WhatsApp Business number a message
// arrived on (which n8n already has, same field whatsapp-sync's
// handleInbound uses) and the customer's message text, it resolves the
// tenant and returns:
//   - a deterministic auto-reply match, if one of the tenant's simple
//     greeting/keyword/fallback rules fires — cheap and instant, the agent
//     (or an n8n IF node before the agent) can just send this verbatim
//     without spending an LLM call
//   - the tenant's top-matching FAQ articles, for the agent to ground its
//     own generated reply in instead of hallucinating
//   - the tenant's top-matching imported catalog rows (from an Excel/CSV
//     product import), same purpose as the FAQ articles above
//   - the tenant's top-matching PDF/DOCX text passages (from a document
//     import), same purpose again — raw text for the agent to ground in
//   - the tenant's configured tone and business hours, to steer the
//     agent's system prompt per-business instead of one static prompt
//
// Same shared-secret auth as whatsapp-sync (WHATSAPP_WEBHOOK_SECRET) so no
// new credential needs configuring in n8n — just a second HTTP node
// pointed at this function's URL with the same header.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bizkey-webhook-secret',
}

interface RequestBody {
  businessNumber?: string
  query?: string
  /** Cap on how many FAQ articles come back — default 3. */
  limit?: number
}

interface AutoReplyRule {
  id: string
  trigger_type: 'greeting' | 'keyword' | 'fallback'
  trigger_value: string | null
  kb_article_id: string | null
  response_text: string | null
  is_active: boolean
  sort_order: number
}

interface KbArticle {
  id: string
  title: string
  keywords: string[]
  answer: string
  is_active: boolean
}

interface KnowledgeRecord {
  id: string
  data: { name: string; price?: number | null; stock?: number | null; category?: string | null; description?: string | null }
  searchable_text: string
  is_active: boolean
}

interface KnowledgeChunk {
  id: string
  content: string
}

interface MatchedChunk {
  id: string
  document_id: string
  content: string
  similarity: number
}

// text-embedding-3-small pricing — $0.02 / 1M input tokens. Only used to log
// a real cost figure into usage_events, matching generate-chunk-embeddings'
// own constant (kept separate since Deno functions can't share a module
// across deploys the way the frontend's src/services/ files do).
const EMBEDDING_COST_PER_TOKEN = 0.02 / 1_000_000
const EMBEDDING_MODEL = 'text-embedding-3-small'
// Cosine similarity below this is treated as "nothing relevant enough" —
// text-embedding-3-small's similarity scores for genuinely related short
// passages typically land well above this; a low-relevance false positive
// quoted back to a customer is worse than the agent getting no passage at
// all and falling back to its own general knowledge / a human handoff.
const MIN_CHUNK_SIMILARITY = 0.3

const GREETING_PATTERNS = ['bonjour', 'bonsoir', 'salut', 'bjr', 'hello', 'hi', 'coucou', 'cc']

function resolveResponseText(rule: AutoReplyRule, kb: KbArticle[]): string | null {
  if (rule.response_text) return rule.response_text
  if (rule.kb_article_id) return kb.find(a => a.id === rule.kb_article_id && a.is_active)?.answer ?? null
  return null
}

// Ported from src/lib/whatsappBot.ts — Deno can't import the frontend's
// Vite-resolved module graph directly, keep matching logic identical if
// that file changes. Keyword before greeting is deliberate: a real message
// is almost never a bare "bonjour", it's "bonjour, combien pour X" and the
// specific answer is always more useful than a generic welcome.
function matchAutoReply(incoming: string, rules: AutoReplyRule[], kb: KbArticle[]) {
  const normalized = incoming.trim().toLowerCase()
  if (!normalized) return null

  const active = [...rules].filter(r => r.is_active).sort((a, b) => a.sort_order - b.sort_order)

  for (const rule of active.filter(r => r.trigger_type === 'keyword')) {
    if (!rule.trigger_value) continue
    if (normalized.includes(rule.trigger_value.trim().toLowerCase())) {
      const text = resolveResponseText(rule, kb)
      if (text) return { rule, responseText: text }
    }
  }

  if (GREETING_PATTERNS.some(g => normalized.includes(g))) {
    for (const rule of active.filter(r => r.trigger_type === 'greeting')) {
      const text = resolveResponseText(rule, kb)
      if (text) return { rule, responseText: text }
    }
  }

  const fallback = active.find(r => r.trigger_type === 'fallback')
  if (fallback) {
    const text = resolveResponseText(fallback, kb)
    if (text) return { rule: fallback, responseText: text }
  }

  return null
}

// Simple substring/token-overlap scoring — no embeddings needed at this
// catalog size. A keyword matching anywhere in the query counts double
// (deliberate signal from whoever wrote the article); a shared title word
// counts once. Ties break toward the article with fewer, more specific
// keywords rather than a generic one that matches everything.
function rankKbArticles(query: string, articles: KbArticle[], limit: number): KbArticle[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2)

  const scored = articles
    .filter(a => a.is_active)
    .map(article => {
      let score = 0
      for (const kw of article.keywords) {
        const k = kw.trim().toLowerCase()
        if (k && normalized.includes(k)) score += 2
      }
      const titleTokens = article.title.toLowerCase().split(/\s+/)
      for (const t of queryTokens) {
        if (titleTokens.some(tt => tt.includes(t) || t.includes(tt))) score += 1
      }
      return { article, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.article.keywords.length - b.article.keywords.length)

  return scored.slice(0, limit).map(s => s.article)
}

// Ported from src/lib/whatsappBot.ts's rankKnowledgeRecords — same
// Deno/Vite module-graph limitation as matchAutoReply/rankKbArticles above.
// Deliberately no embeddings: the agent gets a short ranked list of
// candidate products to ground its own reply in, same shape as the FAQ
// articles below, not an exact-match lookup it blindly parrots back.
function rankKnowledgeRecords(query: string, records: KnowledgeRecord[], limit: number): KnowledgeRecord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2)
  if (queryTokens.length === 0) return []

  const scored = records
    .filter(r => r.is_active)
    .map(record => {
      let score = 0
      if (record.searchable_text.includes(normalized)) score += 3
      for (const t of queryTokens) {
        if (record.searchable_text.includes(t)) score += 1
      }
      return { record, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.record)
}

// Ported from src/lib/whatsappBot.ts's rankKnowledgeChunks — same reason as
// the two ranking functions above. PDF/DOCX passages instead of structured
// catalog rows; the agent gets the raw text to ground its reply in, not a
// verbatim answer to parrot.
function rankKnowledgeChunks(query: string, chunks: KnowledgeChunk[], limit: number): KnowledgeChunk[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  const queryTokens = normalized.split(/\s+/).filter(t => t.length > 2)
  if (queryTokens.length === 0) return []

  const scored = chunks
    .map(chunk => {
      const content = chunk.content.toLowerCase()
      let score = 0
      if (content.includes(normalized)) score += 3
      for (const t of queryTokens) {
        if (content.includes(t)) score += 1
      }
      return { chunk, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.chunk)
}

// Runs only when keyword scoring above found zero document passages — the
// common case (a real keyword hit) never pays for an OpenAI call at all.
// Embeds the customer's message and calls match_knowledge_chunks (see
// 20260901110000_knowledge_chunk_embeddings.sql) for a semantic fallback
// that survives a paraphrase sharing no words with the source document.
// Every failure path here returns an empty array rather than throwing —
// this is an enhancement on top of an already-complete keyword result,
// never something the caller should have to handle failing.
async function fallbackToChunkEmbedding(
  // deno-lint-ignore no-explicit-any
  admin: any,
  query: string,
  clientId: string | null,
  limit: number,
): Promise<{ passages: string[]; costAmount: number; totalTokens: number }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return { passages: [], costAmount: 0, totalTokens: 0 }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return { passages: [], costAmount: 0, totalTokens: 0 }

    const data = await response.json()
    const queryEmbedding = data.data?.[0]?.embedding
    const totalTokens = data.usage?.total_tokens ?? 0
    if (!queryEmbedding) return { passages: [], costAmount: 0, totalTokens }

    const { data: matches } = await admin.rpc('match_knowledge_chunks', {
      p_query_embedding: queryEmbedding,
      p_client_id: clientId,
      p_match_count: limit,
    })
    const passages = ((matches ?? []) as MatchedChunk[])
      .filter(m => m.similarity >= MIN_CHUNK_SIMILARITY)
      .map(m => m.content)

    return { passages, costAmount: totalTokens * EMBEDDING_COST_PER_TOKEN, totalTokens }
  } catch (err) {
    console.warn('Chunk embedding fallback failed:', err)
    return { passages: [], costAmount: 0, totalTokens: 0 }
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expectedSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')
  const providedSecret = req.headers.get('x-bizkey-webhook-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }

  const { businessNumber, query } = body
  const limit = Math.min(Math.max(body.limit ?? 3, 1), 10)
  if (!businessNumber || !query?.trim()) {
    return json({ error: 'missing required fields: businessNumber, query' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: num } = await supabase
    .from('whatsapp_numbers')
    .select('client_id')
    .eq('phone_number', businessNumber)
    .maybeSingle()
  const clientId: string | null = num?.client_id ?? null

  let companyName: string | null = null
  let tone = 'professional'
  let businessHours: unknown = null
  if (clientId) {
    const { data: client } = await supabase
      .from('assistant_clients')
      .select('company_name, tone, business_hours')
      .eq('id', clientId)
      .maybeSingle()
    if (client) {
      companyName = client.company_name
      tone = client.tone ?? 'professional'
      businessHours = client.business_hours
    }
  }

  const scopedQuery = (table: string, select: string) => {
    const q = supabase.from(table).select(select)
    return clientId ? q.eq('client_id', clientId) : q.is('client_id', null)
  }

  const [{ data: rules }, { data: kb }, { data: records }, { data: chunks }] = await Promise.all([
    scopedQuery('whatsapp_auto_replies', '*'),
    scopedQuery('whatsapp_kb_articles', 'id, title, keywords, answer, is_active'),
    scopedQuery('knowledge_records', 'id, data, searchable_text, is_active'),
    scopedQuery('knowledge_chunks', 'id, content'),
  ])

  const kbArticles = (kb ?? []) as KbArticle[]
  const autoReplyMatch = matchAutoReply(query, (rules ?? []) as AutoReplyRule[], kbArticles)
  const knowledgeBase = rankKbArticles(query, kbArticles, limit)
  const catalog = rankKnowledgeRecords(query, (records ?? []) as KnowledgeRecord[], limit)

  let documentPassages = rankKnowledgeChunks(query, (chunks ?? []) as KnowledgeChunk[], limit).map(c => c.content)
  let embeddingCost = 0
  if (documentPassages.length === 0) {
    const fallback = await fallbackToChunkEmbedding(supabase, query, clientId, limit)
    documentPassages = fallback.passages
    embeddingCost = fallback.costAmount
    if (fallback.totalTokens > 0) {
      await supabase.from('usage_events').insert({
        client_id: clientId,
        event_type: 'embedding_generation',
        quantity: 1,
        unit: 'count',
        cost_amount: embeddingCost,
        metadata: { purpose: 'query_fallback', model: EMBEDDING_MODEL, total_tokens: fallback.totalTokens },
      }).then(({ error }: { error: { message: string } | null }) => { if (error) console.warn('usage_events insert failed:', error.message) })
    }
  }

  return json({
    clientId,
    companyName,
    tone,
    businessHours,
    autoReply: autoReplyMatch
      ? { matched: true, responseText: autoReplyMatch.responseText, triggerType: autoReplyMatch.rule.trigger_type }
      : { matched: false },
    knowledgeBase: knowledgeBase.map(a => ({ title: a.title, answer: a.answer, keywords: a.keywords })),
    catalog: catalog.map(r => r.data),
    documentPassages,
  })
})
