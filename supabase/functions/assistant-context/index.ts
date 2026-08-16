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

const GREETING_PATTERNS = ['bonjour', 'bonsoir', 'salut', 'bjr', 'hello', 'hi', 'coucou', 'cc']

function resolveResponseText(rule: AutoReplyRule, kb: KbArticle[]): string | null {
  if (rule.response_text) return rule.response_text
  if (rule.kb_article_id) return kb.find(a => a.id === rule.kb_article_id && a.is_active)?.answer ?? null
  return null
}

// Ported from src/lib/whatsappBot.ts — Deno can't import the frontend's
// Vite-resolved module graph directly, keep matching logic identical if
// that file changes.
function matchAutoReply(incoming: string, rules: AutoReplyRule[], kb: KbArticle[]) {
  const normalized = incoming.trim().toLowerCase()
  if (!normalized) return null

  const active = [...rules].filter(r => r.is_active).sort((a, b) => a.sort_order - b.sort_order)

  if (GREETING_PATTERNS.some(g => normalized.includes(g))) {
    for (const rule of active.filter(r => r.trigger_type === 'greeting')) {
      const text = resolveResponseText(rule, kb)
      if (text) return { rule, responseText: text }
    }
  }

  for (const rule of active.filter(r => r.trigger_type === 'keyword')) {
    if (!rule.trigger_value) continue
    if (normalized.includes(rule.trigger_value.trim().toLowerCase())) {
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

  const [{ data: rules }, { data: kb }] = await Promise.all([
    scopedQuery('whatsapp_auto_replies', '*'),
    scopedQuery('whatsapp_kb_articles', 'id, title, keywords, answer, is_active'),
  ])

  const kbArticles = (kb ?? []) as KbArticle[]
  const autoReplyMatch = matchAutoReply(query, (rules ?? []) as AutoReplyRule[], kbArticles)
  const knowledgeBase = rankKbArticles(query, kbArticles, limit)

  return json({
    clientId,
    companyName,
    tone,
    businessHours,
    autoReply: autoReplyMatch
      ? { matched: true, responseText: autoReplyMatch.responseText, triggerType: autoReplyMatch.rule.trigger_type }
      : { matched: false },
    knowledgeBase: knowledgeBase.map(a => ({ title: a.title, answer: a.answer, keywords: a.keywords })),
  })
})
