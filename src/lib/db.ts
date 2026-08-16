import { supabase } from './supabase'
import type { Database, ERPClient, ERPOrder, ERPDelivery, ERPCountry, ERPOrderStatus, ERPDeliveryStatus, Plan, Subscription, PaymentTransaction, PromoCode, CreditBalance, QuoteRequest, WhatsAppNumber, WhatsAppConversation, WhatsAppMessage, WhatsAppKbArticle, WhatsAppAutoReply, AssistantPlan, AssistantClient, AssistantTone } from './supabase'
import { matchAutoReply } from './whatsappBot'

type Profile = Database['public']['Tables']['profiles']['Row']
type Analysis = Database['public']['Tables']['analyses']['Row']
type Comparison = Database['public']['Tables']['comparisons']['Row']
type Negotiation = Database['public']['Tables']['negotiations']['Row']

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('getProfile error:', error.message)
    return null
  }
  return data
}

export async function updateProfile(userId: string, updates: Database['public']['Tables']['profiles']['Update']) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ─── Analyses ─────────────────────────────────────────────────────────────────

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
  productData: import('./supabase').ProductData
  analysis: import('./supabase').AIAnalysisResult
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

  if (error) throw error
  return data
}

export async function deleteAnalysis(id: string) {
  const { error } = await supabase
    .from('analyses')
    .delete()
    .eq('id', id)

  if (error) throw error
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

  if (error) throw error
}

// ─── Credits ──────────────────────────────────────────────────────────────────

export async function decrementCredits(userId: string) {
  const { error } = await supabase.rpc('decrement_credits', { user_id: userId })
  if (error) throw error
}

// ─── Comparisons ──────────────────────────────────────────────────────────────

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

  if (error) throw error
  return data
}

export async function getUserComparisons(userId: string): Promise<Comparison[]> {
  const { data, error } = await supabase
    .from('comparisons')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function deleteComparison(id: string) {
  const { error } = await supabase
    .from('comparisons')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteComparisons(ids: string[]) {
  const { error } = await supabase
    .from('comparisons')
    .delete()
    .in('id', ids)

  if (error) throw error
}

// ─── Negotiations ─────────────────────────────────────────────────────────────

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

  if (error) throw error
  return data
}

export async function getUserNegotiations(userId: string): Promise<Negotiation[]> {
  const { data, error } = await supabase
    .from('negotiations')
    .select('*, analyses(product_name, product_url, price)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ─── ERP: Clients ─────────────────────────────────────────────────────────────

export async function getERPClients(userId: string): Promise<ERPClient[]> {
  const { data, error } = await supabase
    .from('erp_clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ERPClient[]
}

export async function createERPClient(userId: string, client: Omit<ERPClient, 'id' | 'user_id' | 'created_at'>): Promise<ERPClient> {
  const { data, error } = await supabase
    .from('erp_clients')
    .insert({ ...client, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as ERPClient
}

export async function updateERPClient(id: string, updates: Partial<Omit<ERPClient, 'id' | 'user_id' | 'created_at'>>): Promise<ERPClient> {
  const { data, error } = await supabase
    .from('erp_clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ERPClient
}

export async function deleteERPClient(id: string) {
  const { error } = await supabase.from('erp_clients').delete().eq('id', id)
  if (error) throw error
}

// ─── ERP: Orders ──────────────────────────────────────────────────────────────

export async function getERPOrders(userId: string): Promise<ERPOrder[]> {
  const { data, error } = await supabase
    .from('erp_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ERPOrder[]
}

export async function createERPOrder(userId: string, order: Omit<ERPOrder, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ERPOrder> {
  const { data, error } = await supabase
    .from('erp_orders')
    .insert({ ...order, user_id: userId, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as ERPOrder
}

export async function updateERPOrder(id: string, updates: Partial<Omit<ERPOrder, 'id' | 'user_id' | 'created_at'>>): Promise<ERPOrder> {
  const { data, error } = await supabase
    .from('erp_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ERPOrder
}

export async function deleteERPOrder(id: string) {
  const { error } = await supabase.from('erp_orders').delete().eq('id', id)
  if (error) throw error
}

/** Client-facing: orders placed under this customer's own account, via the erp_orders_customer_read RLS policy. */
export async function getMyERPOrders(customerId: string): Promise<ERPOrder[]> {
  const { data, error } = await supabase
    .from('erp_orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ERPOrder[]
}

// ─── ERP: Deliveries ──────────────────────────────────────────────────────────

export async function getERPDeliveries(userId: string): Promise<ERPDelivery[]> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ERPDelivery[]
}

export async function createERPDelivery(userId: string, delivery: Omit<ERPDelivery, 'id' | 'user_id' | 'created_at'>): Promise<ERPDelivery> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .insert({ ...delivery, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as ERPDelivery
}

export async function updateERPDelivery(id: string, updates: Partial<Omit<ERPDelivery, 'id' | 'order_id' | 'user_id' | 'created_at'>>): Promise<ERPDelivery> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ERPDelivery
}

/**
 * Client-facing: deliveries for this customer's own orders. erp_deliveries
 * has no customer_id column (deliberately not denormalized — see the
 * erp_deliveries_customer_read RLS policy, which joins through erp_orders
 * instead), so this relies entirely on RLS to scope the rows rather than an
 * explicit .eq() filter.
 */
export async function getMyERPDeliveries(): Promise<ERPDelivery[]> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ERPDelivery[]
}

// Suppress unused import warnings (types used in function signatures above)
export type { ERPCountry, ERPOrderStatus, ERPDeliveryStatus }

// ─── Quote Requests ───────────────────────────────────────────────────────────

export async function getQuoteRequest(id: string): Promise<QuoteRequest | null> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as QuoteRequest | null
}

export async function getMyQuoteRequests(customerId: string): Promise<QuoteRequest[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as QuoteRequest[]
}

export async function createQuoteRequest(
  customerId: string,
  quote: Omit<QuoteRequest, 'id' | 'customer_id' | 'status' | 'quoted_unit_price' | 'quoted_currency' | 'quoted_total' | 'admin_notes' | 'quoted_by' | 'quoted_at' | 'erp_order_id' | 'created_at' | 'updated_at'>
): Promise<QuoteRequest> {
  const { data, error } = await supabase
    .from('quote_requests')
    .insert({ ...quote, customer_id: customerId, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return data as QuoteRequest
}

/** Client accepts or rejects a quote that's awaiting their response — enforced server-side via RPC since RLS can't scope which columns a client may touch. */
export async function respondToQuoteRequest(quoteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_quote_request', { p_quote_id: quoteId, p_accept: accept })
  if (error) throw error
}

/** Re-derives payment truth server-side from a successful payment_transactions row rather than trusting the client. */
export async function markQuoteOrderPaid(quoteId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_quote_order_paid', { p_quote_id: quoteId })
  if (error) throw error
}

export async function getAllQuoteRequests(): Promise<QuoteRequest[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as QuoteRequest[]
}

export async function updateQuoteRequest(id: string, updates: Partial<Omit<QuoteRequest, 'id' | 'customer_id' | 'created_at'>>): Promise<QuoteRequest> {
  const { data, error } = await supabase
    .from('quote_requests')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as QuoteRequest
}

// Sign-up stores country as a free-text French label (see SignUpModal's
// COUNTRY list), while ERPCountry is a narrower set of lowercase keys — only
// the 7 countries the ERP module actually ships logistics data for. Anything
// outside that list (Guinée, RD Congo, Burkina Faso, Autre) has no ERP
// equivalent, so it falls back to Bénin rather than failing the conversion.
const PROFILE_COUNTRY_TO_ERP: Record<string, ERPCountry> = {
  'bénin': 'benin', 'togo': 'togo', 'sénégal': 'senegal', 'mali': 'mali',
  "côte d'ivoire": 'cote_divoire', 'niger': 'niger', 'cameroun': 'cameroun',
}

function resolveErpCountry(profileCountry: string | null | undefined): ERPCountry {
  if (!profileCountry) return 'benin'
  return PROFILE_COUNTRY_TO_ERP[profileCountry.trim().toLowerCase()] ?? 'benin'
}

/** Admin-only: converts an accepted quote into a real ERP order linked back to the quote. Admin already has full RLS bypass via is_admin(), matching every other admin ERP mutation. */
export async function convertQuoteToOrder(quoteId: string, adminUserId: string): Promise<ERPOrder> {
  const { data: quote, error: quoteErr } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('id', quoteId)
    .single()
  if (quoteErr) throw quoteErr
  const q = quote as QuoteRequest
  if (q.status !== 'accepted') throw new Error('Only an accepted quote can be converted to an order')

  const { data: customerProfile } = await supabase
    .from('profiles')
    .select('country')
    .eq('id', q.customer_id)
    .maybeSingle()

  const orderNumber = `DEV-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${q.id.slice(0, 4)}`

  const { data: order, error: orderErr } = await supabase
    .from('erp_orders')
    .insert({
      user_id: adminUserId,
      customer_id: q.customer_id,
      order_number: orderNumber,
      status: 'confirmed',
      product_name: q.product_name,
      product_url: q.product_url,
      quantity: q.quantity,
      unit_price: q.quoted_unit_price ?? 0,
      currency: q.quoted_currency ?? 'XOF',
      total_amount: q.quoted_total ?? 0,
      destination_country: resolveErpCountry(customerProfile?.country),
      is_paid: false,
    })
    .select()
    .single()
  if (orderErr) throw orderErr

  const { error: updateErr } = await supabase
    .from('quote_requests')
    .update({ erp_order_id: order.id, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
  if (updateErr) throw updateErr

  return order as ERPOrder
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Plan[]
}

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Plan[]
}

export async function createPlan(plan: Omit<Plan, 'id' | 'created_at' | 'updated_at'>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert({ ...plan, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as Plan
}

export async function updatePlan(id: string, updates: Partial<Omit<Plan, 'id' | 'created_at'>>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Plan
}

export async function deletePlan(id: string) {
  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) throw error
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Subscription | null
}

export async function createSubscription(sub: Omit<Subscription, 'id' | 'created_at'>): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(sub)
    .select()
    .single()
  if (error) throw error
  return data as Subscription
}

export async function updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Subscription
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, profiles(email, name), plans(display_name, type)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Subscription[]
}

// ─── Payment Transactions ─────────────────────────────────────────────────────

export async function createTransaction(tx: Omit<PaymentTransaction, 'id' | 'created_at'>): Promise<PaymentTransaction> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .insert(tx)
    .select()
    .single()
  if (error) throw error
  return data as PaymentTransaction
}

export async function getUserTransactions(userId: string): Promise<PaymentTransaction[]> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PaymentTransaction[]
}

export async function getAllTransactions(filters?: {
  status?: string
  gateway?: string
  country?: string
  from?: string
  to?: string
}): Promise<PaymentTransaction[]> {
  let query = supabase
    .from('payment_transactions')
    .select('*, profiles(email, name)')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.gateway) query = query.eq('gateway', filters.gateway)
  if (filters?.country) query = query.eq('country_code', filters.country)
  if (filters?.from) query = query.gte('created_at', filters.from)
  if (filters?.to) query = query.lte('created_at', filters.to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as PaymentTransaction[]
}

export async function updateTransaction(id: string, updates: Partial<Omit<PaymentTransaction, 'id' | 'user_id' | 'created_at'>>): Promise<PaymentTransaction> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as PaymentTransaction
}

// ─── Credit Balance ───────────────────────────────────────────────────────────

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  if (error) throw error
  return data as CreditBalance
}

export async function consumeBasicCredit(userId: string, feature?: string): Promise<{ success: boolean; reason?: string; source?: string }> {
  const { data, error } = await supabase.rpc('consume_basic_credit', {
    p_user_id: userId,
    p_feature: feature ?? null,
  })
  if (error) throw error
  return data as { success: boolean; reason?: string; source?: string }
}

export async function consumeAdvancedCredit(userId: string, feature?: string): Promise<{ success: boolean; reason?: string; source?: string }> {
  const { data, error } = await supabase.rpc('consume_advanced_credit', {
    p_user_id: userId,
    p_feature: feature ?? null,
  })
  if (error) throw error
  return data as { success: boolean; reason?: string; source?: string }
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data as PromoCode | null
}

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PromoCode[]
}

export async function createPromoCode(promo: Omit<PromoCode, 'id' | 'created_at' | 'used_count'>): Promise<PromoCode> {
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({ ...promo, used_count: 0 })
    .select()
    .single()
  if (error) throw error
  return data as PromoCode
}

export async function updatePromoCode(id: string, updates: Partial<Omit<PromoCode, 'id' | 'created_at'>>): Promise<PromoCode> {
  const { data, error } = await supabase
    .from('promo_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as PromoCode
}

// ─── Exchange Rates ───────────────────────────────────────────────────────────

export async function getExchangeRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('base_currency, target_currency, rate')
  if (error) throw error
  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    map[`${row.base_currency}_${row.target_currency}`] = row.rate
  }
  return map
}

export async function updateExchangeRate(base: string, target: string, rate: number) {
  const { error } = await supabase
    .from('exchange_rates')
    .upsert({ base_currency: base, target_currency: target, rate, fetched_at: new Date().toISOString() }, { onConflict: 'base_currency,target_currency' })
  if (error) throw error
}

// ─── Admin: All Users ─────────────────────────────────────────────────────────

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId)
  if (error) throw error
}

// ─── Admin: Analytics / MRR ──────────────────────────────────────────────────

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

// ─── BizKey Assistant (WhatsApp) ───────────────────────────────────────────

export async function getWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
  const { data, error } = await supabase.from('whatsapp_numbers').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WhatsAppNumber[]
}

export async function createWhatsAppNumber(number: Omit<WhatsAppNumber, 'id' | 'created_at'>): Promise<WhatsAppNumber> {
  const { data, error } = await supabase.from('whatsapp_numbers').insert(number).select().single()
  if (error) throw error
  return data as WhatsAppNumber
}

export async function updateWhatsAppNumber(id: string, updates: Partial<Omit<WhatsAppNumber, 'id' | 'created_at'>>): Promise<WhatsAppNumber> {
  const { data, error } = await supabase.from('whatsapp_numbers').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as WhatsAppNumber
}

export async function deleteWhatsAppNumber(id: string) {
  const { error } = await supabase.from('whatsapp_numbers').delete().eq('id', id)
  if (error) throw error
}

export async function getWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WhatsAppConversation[]
}

export async function updateWhatsAppConversation(id: string, updates: Partial<Omit<WhatsAppConversation, 'id' | 'created_at'>>): Promise<WhatsAppConversation> {
  const { data, error } = await supabase.from('whatsapp_conversations').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as WhatsAppConversation
}

export async function getWhatsAppMessages(conversationId: string): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as WhatsAppMessage[]
}

/** Flat message feed across every conversation, for the overview dashboard's charts — channel/type/sender are all denormalized onto whatsapp_messages so this needs no join. */
export async function getWhatsAppMessagesForAnalytics(limit = 1000): Promise<WhatsAppMessage[]> {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as WhatsAppMessage[]
}

export async function sendWhatsAppAgentReply(conversationId: string, body: string): Promise<WhatsAppMessage> {
  const { data: convo } = await supabase
    .from('whatsapp_conversations')
    .select('channel')
    .eq('id', conversationId)
    .single()
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({ conversation_id: conversationId, direction: 'outbound', sender_type: 'agent', body, channel: convo?.channel ?? 'whatsapp' })
    .select()
    .single()
  if (error) throw error
  await supabase.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
  return data as WhatsAppMessage
}

/**
 * Simulates an inbound WhatsApp message end-to-end: finds or creates the
 * conversation, records the inbound message, runs it through the same
 * matchAutoReply() engine a real webhook would use, and records the bot's
 * reply (or flips the conversation to pending_human if nothing matched).
 * This is how BizKey Assistant is testable today without a live WhatsApp
 * Business API account.
 */
export async function simulateIncomingWhatsAppMessage(params: {
  customerPhone: string
  customerName?: string
  numberId?: string | null
  body: string
}): Promise<{ conversation: WhatsAppConversation; messages: WhatsAppMessage[]; matched: boolean }> {
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('customer_phone', params.customerPhone)
    .neq('status', 'closed')
    .maybeSingle()

  let conversation = existing as WhatsAppConversation | null
  if (!conversation) {
    const { data: created, error: createErr } = await supabase
      .from('whatsapp_conversations')
      .insert({
        number_id: params.numberId ?? null,
        customer_phone: params.customerPhone,
        customer_name: params.customerName ?? null,
        status: 'open',
      })
      .select()
      .single()
    if (createErr) throw createErr
    conversation = created as WhatsAppConversation
  }

  const { error: inboundErr } = await supabase
    .from('whatsapp_messages')
    .insert({ conversation_id: conversation.id, direction: 'inbound', sender_type: 'customer', body: params.body })
  if (inboundErr) throw inboundErr

  const [rules, kbArticles] = await Promise.all([getWhatsAppAutoReplies(), getWhatsAppKbArticles()])
  const match = matchAutoReply(params.body, rules, kbArticles)

  let matched = false
  if (match) {
    matched = true
    const { error: botErr } = await supabase
      .from('whatsapp_messages')
      .insert({ conversation_id: conversation.id, direction: 'outbound', sender_type: 'bot', body: match.responseText })
    if (botErr) throw botErr
  }

  const { data: updatedConv, error: updateErr } = await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString(), status: matched ? conversation.status : 'pending_human' })
    .eq('id', conversation.id)
    .select()
    .single()
  if (updateErr) throw updateErr

  const messages = await getWhatsAppMessages(conversation.id)
  return { conversation: updatedConv as WhatsAppConversation, messages, matched }
}

export async function getWhatsAppKbArticles(): Promise<WhatsAppKbArticle[]> {
  const { data, error } = await supabase.from('whatsapp_kb_articles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WhatsAppKbArticle[]
}

/** Public-facing: only active articles, readable by anonymous visitors on the /aide help page — same table that powers the Assistant bot's auto-replies. */
export async function getPublicKbArticles(): Promise<WhatsAppKbArticle[]> {
  const { data, error } = await supabase
    .from('whatsapp_kb_articles')
    .select('*')
    .eq('is_active', true)
    .order('title', { ascending: true })
  if (error) throw error
  return (data ?? []) as WhatsAppKbArticle[]
}

export async function createWhatsAppKbArticle(article: Omit<WhatsAppKbArticle, 'id' | 'created_at' | 'updated_at'>): Promise<WhatsAppKbArticle> {
  const { data, error } = await supabase.from('whatsapp_kb_articles').insert(article).select().single()
  if (error) throw error
  return data as WhatsAppKbArticle
}

export async function updateWhatsAppKbArticle(id: string, updates: Partial<Omit<WhatsAppKbArticle, 'id' | 'created_at' | 'updated_at'>>): Promise<WhatsAppKbArticle> {
  const { data, error } = await supabase
    .from('whatsapp_kb_articles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as WhatsAppKbArticle
}

export async function deleteWhatsAppKbArticle(id: string) {
  const { error } = await supabase.from('whatsapp_kb_articles').delete().eq('id', id)
  if (error) throw error
}

export async function getWhatsAppAutoReplies(): Promise<WhatsAppAutoReply[]> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as WhatsAppAutoReply[]
}

export async function createWhatsAppAutoReply(rule: Omit<WhatsAppAutoReply, 'id' | 'created_at'>): Promise<WhatsAppAutoReply> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').insert(rule).select().single()
  if (error) throw error
  return data as WhatsAppAutoReply
}

export async function updateWhatsAppAutoReply(id: string, updates: Partial<Omit<WhatsAppAutoReply, 'id' | 'created_at'>>): Promise<WhatsAppAutoReply> {
  const { data, error } = await supabase.from('whatsapp_auto_replies').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data as WhatsAppAutoReply
}

export async function deleteWhatsAppAutoReply(id: string) {
  const { error } = await supabase.from('whatsapp_auto_replies').delete().eq('id', id)
  if (error) throw error
}

// ─── BizKey Assistant: Plans & Clients ─────────────────────────────────────

export async function getAssistantPlans(): Promise<AssistantPlan[]> {
  const { data, error } = await supabase
    .from('assistant_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as AssistantPlan[]
}

export async function getAllAssistantPlans(): Promise<AssistantPlan[]> {
  const { data, error } = await supabase.from('assistant_plans').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as AssistantPlan[]
}

export async function getAssistantClients(): Promise<AssistantClient[]> {
  const { data, error } = await supabase.from('assistant_clients').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AssistantClient[]
}

export async function createAssistantClient(client: Omit<AssistantClient, 'id' | 'created_at' | 'updated_at'>): Promise<AssistantClient> {
  const { data, error } = await supabase.from('assistant_clients').insert(client).select().single()
  if (error) throw error
  return data as AssistantClient
}

export async function updateAssistantClient(id: string, updates: Partial<Omit<AssistantClient, 'id' | 'created_at'>>): Promise<AssistantClient> {
  const { data, error } = await supabase
    .from('assistant_clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as AssistantClient
}

export async function deleteAssistantClient(id: string) {
  const { error } = await supabase.from('assistant_clients').delete().eq('id', id)
  if (error) throw error
}

/** The logged-in customer's own Assistant subscription — null if they've never paid for one. Relies on the additive `assistant_clients_own_read` RLS policy. */
export async function getMyAssistantClient(userId: string): Promise<AssistantClient | null> {
  const { data, error } = await supabase
    .from('assistant_clients')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as AssistantClient | null
}

/** Activates (or upgrades) the caller's own Assistant subscription — server-side re-verifies a successful payment exists for this transaction before writing anything. */
export async function activateAssistantSubscription(transactionId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_assistant_subscription', { p_transaction_id: transactionId })
  if (error) throw error
}

/** Updates the caller's own tone/hours/requested-number — never plan_id or status, which stay admin/RPC-only. */
export async function updateMyAssistantSettings(settings: {
  tone: AssistantTone
  businessHours: Record<string, unknown> | null
  requestedWhatsappNumber: string | null
}): Promise<AssistantClient> {
  const { data, error } = await supabase.rpc('update_my_assistant_settings', {
    p_tone: settings.tone,
    p_business_hours: settings.businessHours,
    p_requested_whatsapp_number: settings.requestedWhatsappNumber,
  }).single()
  if (error) throw error
  return data as AssistantClient
}


