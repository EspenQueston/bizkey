// WhatsApp Assistant: the message thread itself, plus the two ways a
// message gets created outside of a real inbound webhook — an agent's
// manual reply, and the "simulate an incoming message" dev/demo tool (which
// runs the same matchAutoReply → knowledge-record → knowledge-chunk bot
// pipeline a real webhook would).

import { supabase } from '../lib/supabase'
import { matchAutoReply, rankKnowledgeRecords, formatKnowledgeRecordReply, rankKnowledgeChunks } from '../lib/whatsappBot'
import { getFunctionErrorMessage } from '../lib/api'
import { getWhatsAppAutoReplies } from './whatsappAutoReplies'
import { getWhatsAppKbArticles } from './whatsappKnowledgeBase'
import { getKnowledgeRecords, getKnowledgeChunks } from './knowledge'
import type { WhatsAppConversation, WhatsAppMessage } from '../lib/supabase'

export async function getWhatsAppMessages(conversationId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppMessage[]
}

/** Flat message feed across every conversation, for the overview dashboard's charts — channel/type/sender are all denormalized onto whatsapp_messages so this needs no join. */
export async function getWhatsAppMessagesForAnalytics(limit = 1000): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppMessage[]
}

/**
 * Sends an agent reply — saves it (always) and, for real WhatsApp
 * conversations, forwards it to n8n so it's actually delivered to the
 * customer's phone via the edge function's WHATSAPP_AGENT_REPLY webhook.
 * `delivered: false` means the message is saved in BizKey but never
 * reached WhatsApp — the caller should surface that, not treat it as sent.
 */
export async function sendWhatsAppAgentReply(conversationId: string, body: string): Promise<{ message: WhatsAppMessage; delivered: boolean; deliveryError?: string }> {
  const { data, error } = await supabase.functions.invoke<{ message: WhatsAppMessage; delivered: boolean; deliveryError?: string; error?: string }>('whatsapp-agent-reply', {
    body: { conversationId, body },
  })
  if (error) throw new Error(await getFunctionErrorMessage(error))
  if (!data?.message) throw new Error(data?.error ?? "Échec de l'envoi")
  return { message: data.message, delivered: data.delivered, deliveryError: data.deliveryError }
}

/**
 * Simulates an inbound WhatsApp message end-to-end: finds or creates the
 * conversation, records the inbound message, runs it through the same
 * matchAutoReply() engine a real webhook would use, and records the bot's
 * reply (or flips the conversation to pending_human if nothing matched).
 * This is how BizKey Assistant is testable today without a live WhatsApp
 * Business API account.
 */
/**
 * clientId: which tenant's simulator this is — null for BizKey's own
 * (admin) bucket, or the caller's own business id. Threaded through every
 * insert here because whatsapp_conversations_own_insert / whatsapp_
 * messages_own_insert (owner/manager write RLS) both require it — this
 * previously had no client_id anywhere, which meant it silently only ever
 * worked for admin (whose is_admin() policy bypasses the check) and threw
 * a raw RLS error for any real business owner/manager, caught by testing
 * against a real non-admin account rather than always as admin. Also scopes
 * the auto-reply/KB match itself to this tenant — before, an admin's own
 * simulator run could match a DIFFERENT tenant's rules, since
 * getWhatsAppAutoReplies()/getWhatsAppKbArticles() return every tenant's
 * rows to an admin caller with no filtering.
 */
export async function simulateIncomingWhatsAppMessage(params: {
  customerPhone: string
  customerName?: string
  numberId?: string | null
  body: string
  clientId?: string | null
}): Promise<{ conversation: WhatsAppConversation; messages: WhatsAppMessage[]; matched: boolean }> {
  const clientId = params.clientId ?? null

  // .eq('client_id', null) never matches in PostgREST — null needs .is().
  let existingQuery = supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('customer_phone', params.customerPhone)
    .neq('status', 'closed')
  existingQuery = clientId === null ? existingQuery.is('client_id', null) : existingQuery.eq('client_id', clientId)
  const { data: existing } = await existingQuery.maybeSingle()

  let conversation = existing as WhatsAppConversation | null
  if (!conversation) {
    const { data: created, error: createErr } = await supabase
      .from('whatsapp_conversations')
      .insert({
        number_id: params.numberId ?? null,
        customer_phone: params.customerPhone,
        customer_name: params.customerName ?? null,
        status: 'open',
        client_id: clientId,
      })
      .select()
      .single()
    if (createErr) throw new Error(createErr.message)
    conversation = created as WhatsAppConversation
  }

  const { error: inboundErr } = await supabase
    .from('whatsapp_messages')
    .insert({ conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer', body: params.body, client_id: clientId })
  if (inboundErr) throw new Error(inboundErr.message)

  const [allRules, allKbArticles, allRecords, allChunks] = await Promise.all([
    getWhatsAppAutoReplies(), getWhatsAppKbArticles(), getKnowledgeRecords(clientId), getKnowledgeChunks(clientId),
  ])
  const rules = allRules.filter(r => (r.client_id ?? null) === clientId)
  const kbArticles = allKbArticles.filter(a => (a.client_id ?? null) === clientId)
  const match = matchAutoReply(params.body, rules, kbArticles)
  // Falls back to the imported catalog, then to PDF/DOCX passages, only
  // when nothing more deliberate fired first — a manually-written rule
  // beats a scored catalog lookup, which beats a scored text passage.
  const catalogMatch = match ? null : rankKnowledgeRecords(params.body, allRecords, 1)[0]
  const chunkMatch = match || catalogMatch ? null : rankKnowledgeChunks(params.body, allChunks, 1)[0]

  let matched = false
  if (match) {
    matched = true
    const { error: botErr } = await supabase
      .from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, direction: 'outbound', sender_type: 'bot', body: match.responseText, client_id: clientId })
    if (botErr) throw new Error(botErr.message)
  } else if (catalogMatch) {
    matched = true
    const { error: botErr } = await supabase
      .from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, direction: 'outbound', sender_type: 'bot', body: formatKnowledgeRecordReply(catalogMatch), client_id: clientId })
    if (botErr) throw new Error(botErr.message)
  } else if (chunkMatch) {
    matched = true
    const { error: botErr } = await supabase
      .from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, direction: 'outbound', sender_type: 'bot', body: chunkMatch.content, client_id: clientId })
    if (botErr) throw new Error(botErr.message)
  }

  const { data: updatedConv, error: updateErr } = await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString(), status: matched ? conversation.status : 'pending_human' })
    .eq('id', conversation.id)
    .select()
    .single()
  if (updateErr) throw new Error(updateErr.message)

  const messages = await getWhatsAppMessages(conversation.id)
  return { conversation: updatedConv as WhatsAppConversation, messages, matched }
}
