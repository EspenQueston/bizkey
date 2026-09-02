// Admin dashboard aggregate stats (MRR, tenant counts, etc). Kept on its own
// — the single largest function in the old db.ts and touched by nothing else.

import { supabase } from '../lib/supabase'

export async function getAdminStats() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfWindow = new Date(now.getTime() - 29 * 86400000).toISOString()

  const [txRes, subRes, usageRes, eventsRes, analysesRes, profilesRes] = await Promise.all([
    supabase.from('payment_transactions').select('amount_usd, status, created_at'),
    supabase.from('subscriptions').select('status, plan_id, created_at'),
    supabase.from('usage_logs').select('request_type, source, created_at').gte('created_at', startOfWindow),
    supabase.from('system_events').select('status, service, latency_ms, created_at').gte('created_at', startOfMonth),
    supabase.from('analyses').select('data_source, ai_source, quality_tier, created_at').gte('created_at', startOfWindow),
    supabase.from('profiles').select('created_at').gte('created_at', startOfWindow),
  ])

  if (txRes.error) throw txRes.error
  if (subRes.error) throw subRes.error
  if (usageRes.error) throw usageRes.error
  if (eventsRes.error) throw eventsRes.error
  if (analysesRes.error) throw analysesRes.error
  if (profilesRes.error) throw profilesRes.error

  const successTx = (txRes.data ?? []).filter(t => t.status === 'success')
  const failedTx = (txRes.data ?? []).filter(t => t.status === 'failed')
  const mrr = successTx
    .filter(t => new Date(t.created_at) >= new Date(startOfMonth))
    .reduce((sum, t) => sum + (t.amount_usd ?? 0), 0)

  const totalRevenue = successTx.reduce((sum, t) => sum + (t.amount_usd ?? 0), 0)
  const activeSubs = (subRes.data ?? []).filter(s => s.status === 'active').length

  // usageRes/analysesRes are fetched over a 30-day window (for trend charts
  // below) — filter down to the current calendar month for the "this month"
  // summary numbers so they keep their original meaning.
  const usageThisMonth = (usageRes.data ?? []).filter(u => u.created_at >= startOfMonth)
  const totalRequests = usageThisMonth.length
  const basicRequests = usageThisMonth.filter(u => u.request_type === 'basic').length
  const advancedRequests = usageThisMonth.filter(u => u.request_type === 'advanced').length

  const totalPayments = (txRes.data ?? []).length
  const paymentFailureRate = totalPayments > 0 ? Number(((failedTx.length / totalPayments) * 100).toFixed(2)) : 0

  const events = eventsRes.data ?? []
  const errorEvents = events.filter(e => e.status === 'error')
  const serverErrorRate = events.length > 0 ? Number(((errorEvents.length / events.length) * 100).toFixed(2)) : 0
  const avgLatencyMs = events.length > 0
    ? Math.round(events.reduce((sum, e) => sum + (e.latency_ms ?? 0), 0) / events.length)
    : 0

  const analysesAll30d = analysesRes.data ?? []
  const analysesThisMonth = analysesAll30d.filter(a => a.created_at >= startOfMonth)
  const fallbackAnalyses = analysesThisMonth.filter(a => a.data_source === 'fallback' || a.ai_source === 'fallback')
  const fallbackRate = analysesThisMonth.length > 0 ? Number(((fallbackAnalyses.length / analysesThisMonth.length) * 100).toFixed(2)) : 0

  const highSeverityAlerts = [
    paymentFailureRate >= 20 ? `Taux d'échec paiement élevé (${paymentFailureRate}%)` : null,
    serverErrorRate >= 10 ? `Taux d'erreurs serveur élevé (${serverErrorRate}%)` : null,
    fallbackRate >= 40 ? `Taux fallback IA élevé (${fallbackRate}%)` : null,
  ].filter(Boolean) as string[]

  // ── 30-day trend series (for charts) ────────────────────────────────────
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  const requestsByDayMap = new Map<string, { basic: number; advanced: number }>()
  const signupsByDayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = dayKey(d.toISOString())
    requestsByDayMap.set(key, { basic: 0, advanced: 0 })
    signupsByDayMap.set(key, 0)
  }
  for (const u of usageRes.data ?? []) {
    const key = dayKey(u.created_at)
    const bucket = requestsByDayMap.get(key)
    if (bucket) { if (u.request_type === 'basic') bucket.basic++; else if (u.request_type === 'advanced') bucket.advanced++ }
  }
  for (const p of profilesRes.data ?? []) {
    const key = dayKey(p.created_at)
    if (signupsByDayMap.has(key)) signupsByDayMap.set(key, (signupsByDayMap.get(key) ?? 0) + 1)
  }
  const requestsByDay = Array.from(requestsByDayMap.entries()).map(([date, v]) => ({ date, ...v }))
  const signupsByDay = Array.from(signupsByDayMap.entries()).map(([date, count]) => ({ date, count }))

  const qualityCounts = new Map<string, number>()
  for (const a of analysesAll30d) {
    const tier = a.quality_tier ?? 'inconnu'
    qualityCounts.set(tier, (qualityCounts.get(tier) ?? 0) + 1)
  }
  const qualityBreakdown = Array.from(qualityCounts.entries()).map(([tier, count]) => ({ tier, count }))

  return {
    mrr,
    totalRevenue,
    activeSubs,
    totalRequests,
    basicRequests,
    advancedRequests,
    paymentFailureRate,
    serverErrorRate,
    avgLatencyMs,
    requestsByDay,
    signupsByDay,
    qualityBreakdown,
    fallbackRate,
    highSeverityAlerts,
    analyses30d: analysesAll30d.length,
  }
}
