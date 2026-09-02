// BizKey Sourcing: saved product comparisons.

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Comparison = Database['public']['Tables']['comparisons']['Row']

export async function saveComparison(params: {
  userId: string
  analysisIds: string[]
  winnerAnalysisId?: string
  aiRecommendation?: string
}): Promise<Comparison> {
  const { data, error } = await supabase
    .from('comparisons')
    .insert({
      user_id: params.userId,
      analysis_ids: params.analysisIds,
      winner_analysis_id: params.winnerAnalysisId ?? null,
      ai_recommendation: params.aiRecommendation ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getUserComparisons(userId: string): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from('comparisons')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function deleteComparison(id: string) {
  const { error } = await supabase
    .from('comparisons')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteComparisons(ids: string[]) {
  const { error } = await supabase
    .from('comparisons')
    .delete()
    .in('id', ids)

  if (error) throw new Error(error.message)
}
