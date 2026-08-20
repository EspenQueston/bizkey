import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Reads an already-imported knowledge_documents row (Excel/CSV catalog or
// PDF/DOCX text — see 20260820100000_knowledge_imports.sql /
// 20260820110000_knowledge_chunks.sql) and asks OpenAI to draft realistic
// customer FAQ pairs grounded in that content, so a PME doesn't have to
// hand-write every whatsapp_kb_articles entry themselves. Returns
// suggestions only — it never writes to whatsapp_kb_articles directly, so
// the owner reviews and picks which ones to keep from the UI, the same way
// they already review a CSV import's column mapping before committing it.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface FaqSuggestion { question: string; answer: string }

// gpt-4o-mini pricing as of this integration — $0.15 / 1M input tokens,
// $0.60 / 1M output tokens. Only used to log a real cost figure into
// usage_events, not shown to the end user anywhere.
const INPUT_COST_PER_TOKEN = 0.15 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 0.60 / 1_000_000

function parseJsonObject(content: string): Record<string, unknown> | null {
  const clean = content.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]+\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

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
    .select('id, client_id, title, source_type')
    .eq('id', body.documentId)
    .maybeSingle()
  if (docError) return json({ error: docError.message }, 500)
  if (!doc) return json({ error: 'document not found' }, 404)

  // Authorization mirrors invite_assistant_client_member: admin, or
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

  // Assemble the document's actual content — structured rows for a
  // spreadsheet import, ordered passages for a PDF/DOCX import.
  let sourceText = ''
  if (doc.source_type === 'csv' || doc.source_type === 'xlsx') {
    const { data: records } = await admin
      .from('knowledge_records')
      .select('data')
      .eq('document_id', doc.id)
      .limit(200)
    sourceText = (records ?? [])
      .map((r) => {
        const d = r.data as Record<string, unknown>
        return Object.entries(d)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join(' — ')
      })
      .filter((line) => line !== '')
      .join('\n')
  } else {
    const { data: chunks } = await admin
      .from('knowledge_chunks')
      .select('content')
      .eq('document_id', doc.id)
      .order('chunk_index')
      .limit(60)
    sourceText = (chunks ?? []).map((c) => c.content).join('\n\n')
  }

  if (!sourceText.trim()) return json({ error: 'this document has no content to generate a FAQ from' }, 400)

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return json({ error: 'AI generation is not configured (missing OPENAI_API_KEY)' }, 503)

  const prompt = `Voici le contenu d'un document appartenant à une PME (${doc.title}) :

"""
${sourceText.slice(0, 12000)}
"""

À partir de ce contenu, génère entre 5 et 8 questions fréquentes qu'un client pourrait poser par WhatsApp à cette entreprise, avec une réponse claire et concise pour chacune. Base-toi UNIQUEMENT sur les informations présentes dans le document — n'invente aucune information (prix, délai, politique...) qui n'y figure pas. Si le document ne permet pas de répondre avec certitude à un sujet, ne pose pas de question dessus.

Réponds uniquement avec un objet JSON de cette forme :
{"faqs": [{"question": "...", "answer": "..."}]}`

  let usage = { prompt_tokens: 0, completion_tokens: 0 }
  let faqs: FaqSuggestion[] = []

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: "Tu es un assistant qui aide les PME africaines à préparer une FAQ WhatsApp pour leurs clients. Réponds toujours en JSON valide uniquement, sans markdown." },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45000),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn(`OpenAI error ${response.status}:`, errText.slice(0, 300))
      return json({ error: `AI generation failed (${response.status})` }, 502)
    }

    const data = await response.json()
    usage = data.usage ?? usage
    const content = data.choices?.[0]?.message?.content ?? ''
    const parsed = parseJsonObject(content)
    const rawFaqs = Array.isArray(parsed?.faqs) ? parsed!.faqs : []
    faqs = rawFaqs
      .filter((f: unknown): f is FaqSuggestion =>
        !!f && typeof f === 'object' && typeof (f as FaqSuggestion).question === 'string' && typeof (f as FaqSuggestion).answer === 'string')
      .map((f: FaqSuggestion) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f: FaqSuggestion) => f.question && f.answer)

    if (faqs.length === 0) return json({ error: 'AI returned no usable FAQ suggestions — try a document with more text content' }, 502)
  } catch (err) {
    console.warn('FAQ generation failed:', err)
    return json({ error: 'AI generation failed' }, 502)
  }

  const costAmount = usage.prompt_tokens * INPUT_COST_PER_TOKEN + usage.completion_tokens * OUTPUT_COST_PER_TOKEN
  await admin.from('usage_events').insert({
    client_id: doc.client_id,
    event_type: 'faq_generation',
    quantity: 1,
    unit: 'count',
    cost_amount: costAmount,
    metadata: { document_id: doc.id, model: 'gpt-4o-mini', prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens },
  }).then(({ error }) => { if (error) console.warn('usage_events insert failed:', error.message) })

  return json({ faqs })
})
