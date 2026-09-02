// BizKey Sourcing: product analyses (the core "analyze a supplier link" feature).

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

type Analysis = Database['public']['Tables']['analyses']['Row']

export async function getUserAnalyses(userId: string): Promise<Analysis[]> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('getUserAnalyses error:', error.message)
    return []
  }
  return data ?? []
}

export async function getAnalysis(id: string): Promise<Analysis | null> {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.warn('getAnalysis error:', error.message)
    return null
  }
  return data
}

export async function saveAnalysis(params: {
  userId: string
  productUrl: string
  productData: import('../lib/supabase').ProductData
  analysis: import('../lib/supabase').AIAnalysisResult
}): Promise<Analysis> {
  const { data, error } = await supabase
    .from('analyses')
    .insert({
      user_id: params.userId,
      product_url: params.productUrl,
      product_name: params.productData.name || null,
      supplier_name: params.productData.supplierName || null,
      price: params.productData.price || null,
      moq: params.productData.moq || null,
      confidence_score: params.analysis.confidenceScore,
      ai_analysis: params.analysis as unknown as never,
      raw_product_data: params.productData as unknown as never,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteAnalysis(id: string) {
  const { error } = await supabase
    .from('analyses')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export interface AdminAnalysisRow {
  id: string
  user_id: string
  product_name: string | null
  product_url: string
  supplier_name: string | null
  price: number | null
  confidence_score: number | null
  data_source: string | null
  ai_source: string | null
  quality_tier: string | null
  created_at: string
  user_email: string
  user_name: string | null
  credits_consumed: number
}

/**
 * Every analysis on the platform, joined to its owner and to the credits that
 * analysis actually consumed.
 *
 * Requires the admin RLS policies (20260810150000) — without them this returns
 * only the caller's own rows rather than failing loudly.
 */
export async function getAllAnalysesForAdmin(): Promise<AdminAnalysisRow[]> {
  const [analysesRes, profilesRes, usageRes] = await Promise.all([
    supabase
      .from('analyses')
      .select('id, user_id, product_name, product_url, supplier_name, price, confidence_score, data_source, ai_source, quality_tier, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('profiles').select('id, email, name'),
    supabase.from('usage_logs').select('user_id, credits_consumed, created_at, feature'),
  ])

  if (analysesRes.error) throw analysesRes.error

  const profileById = new Map(
    (profilesRes.data ?? []).map(p => [p.id, { email: p.email as string, name: p.name as string | null }]),
  )

  // usage_logs has no analysis_id, so credits are attributed by matching the
  // analyze log closest in time to each analysis (within a 2-minute window).
  const analyzeLogs = (usageRes.data ?? [])
    .filter(u => !u.feature || u.feature === 'analyze')
    .map(u => ({ userId: u.user_id as string, credits: Number(u.credits_consumed ?? 0), at: new Date(u.created_at as string).getTime() }))

  return (analysesRes.data ?? []).map(a => {
    const at = new Date(a.created_at as string).getTime()
    const match = analyzeLogs.find(l => l.userId === a.user_id && Math.abs(l.at - at) < 120_000)
    const profile = profileById.get(a.user_id as string)
    return {
      ...a,
      user_email: profile?.email ?? '—',
      user_name: profile?.name ?? null,
      credits_consumed: match?.credits ?? 0,
    } as AdminAnalysisRow
  })
}

export async function deleteAnalyses(ids: string[]) {
  const { error } = await supabase
    .from('analyses')
    .delete()
    .in('id', ids)

  if (error) throw new Error(error.message)
}
