// WhatsApp Assistant: conversations and the contacts they link to. Both
// queries rely entirely on RLS for tenant scoping — no clientId parameter,
// same pattern as the rest of this domain.

import { supabase } from '../lib/supabase'
import type { WhatsAppContact, WhatsAppConversation } from '../lib/supabase'

export async function getWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppConversation[]
}

/** RLS already scopes this to the caller's own business (or every contact for admin) — no clientId param needed, same pattern as getWhatsAppConversations. */
export async function getWhatsAppContacts(): Promise<WhatsAppContact[]> {
  const { data, error } = await supabase.from('whatsapp_contacts').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppContact[]
}

/** Server-side count against a business's plan.max_conversations_per_month — a `head: true` count query, not a fetch-everything-then-filter-in-JS like AssistantBilling.tsx used to do. clientId null means BizKey's own bucket. */
export async function getConversationCountSince(clientId: string | null, since: string): Promise<number> {
  let query = supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).gte('created_at', since)
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function updateWhatsAppConversation(id: string, updates: Partial<Omit<WhatsAppConversation, 'id' | 'created_at'>>): Promise<WhatsAppConversation> {
  const { data, error } = await supabase.from('whatsapp_conversations').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppConversation
}
