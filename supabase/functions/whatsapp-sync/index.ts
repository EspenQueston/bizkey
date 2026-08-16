import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Webhook n8n calls at two points in the WhatsApp workflow:
//   1. right after "Message Is Valid?" passes, for the inbound customer
//      message (text / audio-transcript / parcel-image) — BEFORE the AI Agent
//   2. right after "WA - Send Reply", for the outbound AI/agent reply
//
// n8n owns the actual WhatsApp send/receive (Evolution API) and the AI
// agent's own conversational memory (n8n's separate Postgres). This function
// only mirrors messages into BizKey's Supabase so the admin panel's
// Conversations page shows real traffic instead of simulator data.
//
// Sourcing-specific fields (product-image search, credits, Onebound) are
// intentionally not handled here yet — phase 1 covers Assistant support +
// parcel tracking only.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bizkey-webhook-secret',
}

interface InboundBody {
  event: 'message.inbound'
  providerEventId: string
  providerMessageId?: string
  whatsappNumber: string
  businessNumber?: string
  customerName?: string
  messageType: 'text' | 'audio' | 'image'
  imageIntent?: 'parcel' | 'product' | 'unknown'
  messageText?: string
  trackingNumber?: string
  carrier?: string
  mediaUrl?: string
  receivedAt?: string
}

interface OutboundBody {
  event: 'message.outbound'
  conversationId: string
  providerMessageId?: string
  responseText: string
  aiCost?: number
  sentStatus?: 'sent' | 'failed'
  sentAt?: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expectedSecret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET')
  const providedSecret = req.headers.get('x-bizkey-webhook-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: InboundBody | OutboundBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json body' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (body.event === 'message.inbound') return handleInbound(supabase, body)
  if (body.event === 'message.outbound') return handleOutbound(supabase, body)
  return json({ error: 'unknown event type' }, 400)
})

// Evolution API (Baileys) reports its own message-type vocabulary
// ("conversation", "extendedTextMessage", "audioMessage", ...), not the
// simplified text/audio/image the rest of BizKey works with. n8n passes the
// raw value through as-is; this is the one place that translates it, so
// n8n's node config never has to hardcode per-branch literals.
const MESSAGE_TYPE_MAP: Record<string, 'text' | 'audio' | 'image'> = {
  conversation: 'text',
  extendedTextMessage: 'text',
  audioMessage: 'audio',
  pttMessage: 'audio',
  imageMessage: 'image',
}

function normalizeMessageType(raw: string): 'text' | 'audio' | 'image' | null {
  if (raw === 'text' || raw === 'audio' || raw === 'image') return raw
  return MESSAGE_TYPE_MAP[raw] ?? null
}

// deno-lint-ignore no-explicit-any
async function handleInbound(supabase: any, body: InboundBody) {
  const {
    providerEventId, providerMessageId, whatsappNumber, businessNumber,
    customerName, imageIntent, messageText,
    trackingNumber, carrier, mediaUrl, receivedAt,
  } = body

  if (!providerEventId || !whatsappNumber || !body.messageType) {
    return json({ error: 'missing required fields: providerEventId, whatsappNumber, messageType' }, 400)
  }

  const messageType = normalizeMessageType(body.messageType)
  if (!messageType) {
    return json({ error: `unrecognized messageType: "${body.messageType}" — add it to MESSAGE_TYPE_MAP` }, 400)
  }

  // Dedup — a webhook retry or n8n re-execution must never double-log a
  // message, double-run the AI agent, or double-charge anything downstream.
  const { data: existingEvent } = await supabase
    .from('whatsapp_events')
    .select('id')
    .eq('provider_event_id', providerEventId)
    .maybeSingle()

  if (existingEvent) {
    return json({ dedup: true })
  }

  const { data: contact, error: contactError } = await supabase
    .from('whatsapp_contacts')
    .upsert(
      { whatsapp_number: whatsappNumber, display_name: customerName ?? null },
      { onConflict: 'whatsapp_number', ignoreDuplicates: false },
    )
    .select('id, is_provisional')
    .single()
  if (contactError) return json({ error: contactError.message }, 500)

  let numberId: string | null = null
  if (businessNumber) {
    const { data: num } = await supabase
      .from('whatsapp_numbers')
      .select('id')
      .eq('phone_number', businessNumber)
      .maybeSingle()
    numberId = num?.id ?? null
  }

  // Reuse the contact's most recent non-closed conversation; otherwise start one.
  const { data: existingConvo } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('contact_id', contact.id)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId: string
  const nowIso = receivedAt ?? new Date().toISOString()

  if (existingConvo) {
    conversationId = existingConvo.id
    await supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: nowIso, ...(customerName ? { customer_name: customerName } : {}) })
      .eq('id', conversationId)
  } else {
    const { data: newConvo, error: convoError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        number_id: numberId,
        contact_id: contact.id,
        customer_phone: whatsappNumber,
        customer_name: customerName ?? null,
        status: 'open',
        last_message_at: nowIso,
      })
      .select('id')
      .single()
    if (convoError) return json({ error: convoError.message }, 500)
    conversationId = newConvo.id
  }

  const { error: msgError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'inbound',
    sender_type: 'customer',
    body: messageText ?? '',
    provider_message_id: providerMessageId ?? null,
    message_type: messageType,
    image_intent: imageIntent ?? null,
    tracking_number: trackingNumber ?? null,
    carrier: carrier ?? null,
    media_url: mediaUrl ?? null,
  })
  if (msgError) return json({ error: msgError.message }, 500)

  await supabase.from('whatsapp_events').insert({
    provider_event_id: providerEventId,
    provider_message_id: providerMessageId ?? null,
    event_type: 'inbound',
  })

  return json({
    dedup: false,
    conversationId,
    contactId: contact.id,
    isNewContact: contact.is_provisional,
  })
}

// deno-lint-ignore no-explicit-any
async function handleOutbound(supabase: any, body: OutboundBody) {
  const { conversationId, providerMessageId, responseText, aiCost, sentStatus, sentAt } = body

  if (!conversationId || !responseText) {
    return json({ error: 'missing required fields: conversationId, responseText' }, 400)
  }

  const { error: msgError } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    sender_type: 'bot',
    body: responseText,
    provider_message_id: providerMessageId ?? null,
    ai_cost: aiCost ?? null,
  })
  if (msgError) return json({ error: msgError.message }, 500)

  await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: sentAt ?? new Date().toISOString() })
    .eq('id', conversationId)

  return json({ ok: true, sentStatus: sentStatus ?? 'sent' })
}
