// BizKey Sourcing: saved supplier negotiation scripts.

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Negotiation = Database['public']['Tables']['negotiations']['Row']

export async function saveNegotiation(params: {
  userId: string
  analysisId: string
  targetPrice: number
  strategy: object
  messages: object
}): Promise<Negotiation> {
  const { data, error } = await supabase
    .from('negotiations')
    .insert({
      user_id: params.userId,
      analysis_id: params.analysisId,
      target_price: params.targetPrice,
      strategy: params.strategy as unknown as never,
      messages: params.messages as unknown as never,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getUserNegotiations(userId: string): Promise<Negotiation[]> {
  const { data, error } = await supabase
    .from('negotiations')
    .select('*, analyses(product_name, product_url, price)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
