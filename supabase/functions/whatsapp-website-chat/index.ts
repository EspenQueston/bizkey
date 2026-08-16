import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Public, no-login BizKey Assistant chat for the website — open to any
// visitor, matching WhatsApp itself (a phone number never needed a BizKey
// account either). Anonymous identity is a browser-generated UUID the
// frontend persists in localStorage, stored here as "web:<uuid>" in the
// same whatsapp_contacts.whatsapp_number column real phone numbers use —
// same tables, same admin Conversations page, tagged channel: 'website'.
//
// Replies come from the same deterministic auto-reply engine
// (whatsappBot.ts) the admin's local simulator already uses — greeting /
// keyword / fallback against whatsapp_auto_replies + whatsapp_kb_articles.
// This is intentionally NOT routed through n8n's AI Agent yet: that needs
// a website-facing trigger on the n8n side that doesn't exist. Swapping the
// backend brain later won't require any frontend change — same
// conversation records, same UI.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function visitorToNumber(visitorId: string) {
  return `web:${visitorId}`
}

const GREETING_PATTERNS = ['bonjour', 'bonsoir', 'salut', 'bjr', 'hello', 'hi', 'coucou', 'cc']

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
  answer: string
  is_active: boolean
}

function resolveResponseText(rule: AutoReplyRule, kb: KbArticle[]): string | null {
  if (rule.response_text) return rule.response_text
  if (rule.kb_article_id) return kb.find(a => a.id === rule.kb_article_id && a.is_active)?.answer ?? null
  return null
}

// Ported from src/lib/whatsappBot.ts (Deno can't import the frontend's
// Vite-resolved module graph directly) — keep matching logic identical if
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)

  if (req.method === 'GET') {
    const visitorId = url.searchParams.get('visitorId')
    if (!visitorId) return json({ error: 'missing visitorId' }, 400)

    const { data: contact } = await supabase
      .from('whatsapp_contacts')
      .select('id')
      .eq('whatsapp_number', visitorToNumber(visitorId))
      .maybeSingle()

    if (!contact) return json({ conversationId: null, messages: [] })

    const { data: convo } = await supabase
      .from('whatsapp_conversations')
      .select('id, status')
      .eq('contact_id', contact.id)
      .eq('channel', 'website')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!convo) return json({ conversationId: null, messages: [] })

    const { data: messages } = await supabase
      .from('whatsapp_messages')
      .select('id, direction, sender_type, body, created_at')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true })

    return json({ conversationId: convo.id, status: convo.status, messages: messages ?? [] })
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { visitorId?: string; message?: string; visitorName?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }

  const { visitorId, message, visitorName } = body
  if (!visitorId || !message?.trim()) {
    return json({ error: 'missing required fields: visitorId, message' }, 400)
  }

  const whatsappNumber = visitorToNumber(visitorId)

  // This is BizKey's own site-wide widget (client_id null), not a
  // subscribed business's — routed through the same RPC whatsapp-sync uses
  // since whatsapp_contacts' uniqueness is now (client_id, number) via an
  // expression index that a plain .upsert({onConflict}) can't target.
  const { data: contact, error: contactError } = await supabase
    .rpc('upsert_whatsapp_contact', {
      p_client_id: null,
      p_whatsapp_number: whatsappNumber,
      p_display_name: visitorName ?? null,
    })
    .single()
  if (contactError) return json({ error: contactError.message }, 500)

  const { data: existingConvo } = await supabase
    .from('whatsapp_conversations')
    .select('id, status')
    .eq('contact_id', contact.id)
    .eq('channel', 'website')
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nowIso = new Date().toISOString()
  let conversationId: string

  if (existingConvo) {
    conversationId = existingConvo.id
    await supabase.from('whatsapp_conversations').update({ last_message_at: nowIso, status: 'open' }).eq('id', conversationId)
  } else {
    const { data: newConvo, error: convoError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        contact_id: contact.id,
        customer_phone: whatsappNumber,
        customer_name: visitorName ?? null,
        status: 'open',
        last_message_at: nowIso,
        channel: 'website',
      })
      .select('id')
      .single()
    if (convoError) return json({ error: convoError.message }, 500)
    conversationId = newConvo.id
  }

  const { error: inMsgError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    sender_type: 'customer',
    body: message.trim(),
    message_type: 'text',
    channel: 'website',
  })
  if (inMsgError) return json({ error: inMsgError.message }, 500)

  // client_id is null: this widget is BizKey's own — without this filter a
  // subscribed business's private rules/FAQ could match and leak to a
  // random website visitor who never talked to that business.
  const [{ data: rules }, { data: kb }] = await Promise.all([
    supabase.from('whatsapp_auto_replies').select('*').is('client_id', null),
    supabase.from('whatsapp_kb_articles').select('id, answer, is_active').is('client_id', null),
  ])

  const match = matchAutoReply(message, (rules ?? []) as AutoReplyRule[], (kb ?? []) as KbArticle[])

  if (match) {
    const { data: outMsg, error: outMsgError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'bot',
        body: match.responseText,
        message_type: 'text',
        channel: 'website',
      })
      .select('id, body, created_at')
      .single()
    if (outMsgError) return json({ error: outMsgError.message }, 500)

    await supabase.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)

    return json({ conversationId, reply: outMsg, needsHuman: false })
  }

  // No rule matched — hand off to a human rather than send a dead-end reply.
  await supabase.from('whatsapp_conversations').update({ status: 'pending_human', last_message_at: new Date().toISOString() }).eq('id', conversationId)

  return json({ conversationId, reply: null, needsHuman: true })
})
