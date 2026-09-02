// WhatsApp Assistant: the whatsapp_kb_articles table (short Q&A pairs the
// auto-reply engine matches against). Distinct from the document/chunk-based
// knowledge base in services/knowledge.ts.

import { supabase } from '../lib/supabase'
import type { WhatsAppKbArticle } from '../lib/supabase'

export async function getWhatsAppKbArticles(): Promise<WhatsAppKbArticle[]> {
  const { data, error } = await supabase.from('whatsapp_kb_articles').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppKbArticle[]
}

/** Public-facing: only active articles, readable by anonymous visitors on the /aide help page — same table that powers the Assistant bot's auto-replies. */
export async function getPublicKbArticles(): Promise<WhatsAppKbArticle[]> {
  const { data, error } = await supabase
    .from('whatsapp_kb_articles')
    .select('*')
    .eq('is_active', true)
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppKbArticle[]
}

export async function createWhatsAppKbArticle(article: Omit<WhatsAppKbArticle, 'id' | 'created_at' | 'updated_at'>): Promise<WhatsAppKbArticle> {
  const { data, error } = await supabase.from('whatsapp_kb_articles').insert(article).select().single()
  if (error) throw new Error(error.message)
  return data as WhatsAppKbArticle
}

export async function updateWhatsAppKbArticle(id: string, updates: Partial<Omit<WhatsAppKbArticle, 'id' | 'created_at' | 'updated_at'>>): Promise<WhatsAppKbArticle> {
  const { data, error } = await supabase
    .from('whatsapp_kb_articles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as WhatsAppKbArticle
}

export async function deleteWhatsAppKbArticle(id: string) {
  const { error } = await supabase.from('whatsapp_kb_articles').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
