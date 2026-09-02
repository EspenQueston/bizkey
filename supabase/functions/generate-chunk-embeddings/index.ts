import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Embeds a document's knowledge_chunks (PDF/DOCX text passages) with
// OpenAI's text-embedding-3-small, so match_knowledge_chunks (see
// 20260901110000_knowledge_chunk_embeddings.sql) can find a passage that
// answers a paraphrased question sharing no words with the source text —
// something rankKnowledgeChunks' substring/token-overlap scoring in
// src/lib/whatsappBot.ts and supabase/functions/assistant-context can never
// catch on its own. Called automatically right after chunk creation (see
// createKnowledgeDocumentWithChunks in src/services/knowledge.ts) — never
// blocks the upload itself: a chunk with no embedding yet just falls back
// to keyword search until this catches up, or forever if it fails, which is
// why every failure path here degrades instead of throwing back at the
// caller who's already treating this as best-effort.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// text-embedding-3-small pricing as of this integration — $0.02 / 1M input
// tokens, no output tokens (there's no completion, just a vector back).
// Only used to log a real cost figure into usage_events, not shown to the
// end user anywhere — same convention as generate-faq-from-document.
const EMBEDDING_COST_PER_TOKEN = 0.02 / 1_000_000
const EMBEDDING_MODEL = 'text-embedding-3-small'

// Caps one call to a single OpenAI request and a single usage_events row.
// A document with more chunks than this only gets its first 200 (by
// chunk_index) embedded — same limit createKnowledgeDocumentWithChunks'
// sibling (createKnowledgeDocumentWithRecords) already applies to records
// via a 200-row read elsewhere in this codebase. Re-invoking this function
// for the same document would pick up the next unembedded batch, but
// nothing calls it that way today.
const MAX_CHUNKS_PER_CALL = 200

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)

  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }
  if (!body.documentId) return json({ error: 'documentId is required' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const callerClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: doc, error: docError } = await admin
    .from('knowledge_documents')
    .select('id, client_id')
    .eq('id', body.documentId)
    .maybeSingle()
  if (docError) return json({ error: docError.message }, 500)
  if (!doc) return json({ error: 'document not found' }, 404)

  // Same authorization shape as generate-faq-from-document: admin, or
  // owner/manager of the document's own tenant — never anyone else's.
  const { data: callerProfile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  const isAdmin = callerProfile?.is_admin === true
  let isAuthorized = isAdmin
  if (!isAuthorized && doc.client_id) {
    const { data: membership } = await admin
      .from('assistant_client_members')
      .select('role')
      .eq('client_id', doc.client_id)
      .eq('profile_id', user.id)
      .maybeSingle()
    isAuthorized = membership?.role === 'owner' || membership?.role === 'manager'
  }
  if (!isAuthorized) return json({ error: 'forbidden' }, 403)

  const { data: chunks, error: chunksError } = await admin
    .from('knowledge_chunks')
    .select('id, content')
    .eq('document_id', doc.id)
    .is('embedding', null)
    .order('chunk_index')
    .limit(MAX_CHUNKS_PER_CALL)
  if (chunksError) return json({ error: chunksError.message }, 500)
  if (!chunks || chunks.length === 0) return json({ embedded: 0 })

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return json({ error: 'embeddings are not configured (missing OPENAI_API_KEY)' }, 503)

  let embeddings: { embedding: number[]; index: number }[] = []
  let totalTokens = 0

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunks.map((c) => c.content) }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn(`OpenAI embeddings error ${response.status}:`, errText.slice(0, 300))
      return json({ error: `embedding generation failed (${response.status})` }, 502)
    }

    const data = await response.json()
    embeddings = data.data ?? []
    totalTokens = data.usage?.total_tokens ?? 0
    if (embeddings.length !== chunks.length) {
      console.warn(`OpenAI returned ${embeddings.length} embeddings for ${chunks.length} chunks`)
      return json({ error: 'embedding generation returned a mismatched result' }, 502)
    }
  } catch (err) {
    console.warn('Embedding generation failed:', err)
    return json({ error: 'embedding generation failed' }, 502)
  }

  // OpenAI returns embeddings in request order with an `index` back-pointer
  // into `input` — mapped back to the chunk it came from rather than
  // assumed-in-order, in case a future batching change reorders `input`.
  // Plain per-row UPDATEs, not upsert: knowledge_chunks has other NOT NULL
  // columns (document_id, chunk_index, content) with no default, so an
  // upsert payload carrying only {id, embedding} still fails its own
  // constraint check — Postgres validates the attempted INSERT's row before
  // it ever gets to fall through to the ON CONFLICT UPDATE.
  const updateResults = await Promise.all(
    embeddings.map((e) => admin.from('knowledge_chunks').update({ embedding: e.embedding }).eq('id', chunks[e.index].id))
  )
  const updateError = updateResults.find((r) => r.error)?.error
  if (updateError) return json({ error: updateError.message }, 500)

  const costAmount = totalTokens * EMBEDDING_COST_PER_TOKEN
  await admin.from('usage_events').insert({
    client_id: doc.client_id,
    event_type: 'embedding_generation',
    quantity: chunks.length,
    unit: 'count',
    cost_amount: costAmount,
    metadata: { document_id: doc.id, model: EMBEDDING_MODEL, total_tokens: totalTokens },
  }).then(({ error }) => { if (error) console.warn('usage_events insert failed:', error.message) })

  return json({ embedded: chunks.length })
})
