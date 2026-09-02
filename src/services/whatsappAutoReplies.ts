// WhatsApp Assistant: keyword-based auto-reply rules.

import { supabase } from '../lib/supabase'
import type { WhatsAppAutoReply } from '../lib/supabase'

export async function getWhatsAppAutoReplies(): Promise<WhatsAppAutoReply[]> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').select('*').order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppAutoReply[]
}

export async function createWhatsAppAutoReply(rule: Omit<WhatsAppAutoReply, 'id' | 'created_at'>): Promise<WhatsAppAutoReply> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').insert(rule).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppAutoReply
}

export async function updateWhatsAppAutoReply(id: string, updates: Partial<Omit<WhatsAppAutoReply, 'id' | 'created_at'>>): Promise<WhatsAppAutoReply> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppAutoReply
}

export async function deleteWhatsAppAutoReply(id: string) {
  const { error } = await supabase.from('whatsapp_auto_replies').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
