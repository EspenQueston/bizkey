// WhatsApp Assistant: connected WhatsApp Business numbers (admin-managed).

import { supabase } from '../lib/supabase'
import type { WhatsAppNumber } from '../lib/supabase'

export async function getWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
  const { data, error } = await supabase.from('whatsapp_numbers').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppNumber[]
}

export async function createWhatsAppNumber(number: Omit<WhatsAppNumber, 'id' | 'created_at'>): Promise<WhatsAppNumber> {
  const { data, error } = await supabase.from('whatsapp_numbers').insert(number).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppNumber
}

export async function updateWhatsAppNumber(id: string, updates: Partial<Omit<WhatsAppNumber, 'id' | 'created_at'>>): Promise<WhatsAppNumber> {
  const { data, error } = await supabase.from('whatsapp_numbers').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppNumber
}

export async function deleteWhatsAppNumber(id: string) {
  const { error } = await supabase.from('whatsapp_numbers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
