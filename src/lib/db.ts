import { supabase } from './supabase'
import type { Database, ERPClient, ERPOrder, ERPDelivery, ERPCountry, ERPOrderStatus, ERPDeliveryStatus, Plan, Subscription, PaymentTransaction, PromoCode, CreditBalance, QuoteRequest, WhatsAppNumber, WhatsAppConversation, WhatsAppMessage, WhatsAppKbArticle, WhatsAppAutoReply, AssistantPlan, AssistantClient, AssistantTone, AssistantClientMember, AssistantMemberRole, HandoffTicket, UsageEventType, UsageSummary, UsageSummaryByTenant, KnowledgeDocument, KnowledgeRecord, KnowledgeRecordData, KnowledgeChunk } from './supabase'
import { matchAutoReply, rankKnowledgeRecords, formatKnowledgeRecordReply, rankKnowledgeChunks } from './whatsappBot'
import { getFunctionErrorMessage } from './api'

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

  if (error) throw new Error(error.message)
  return data
}

/** Admin-only lookup for linking an order to a real signed-up account (distinct from the erp_clients CRM book, which has no login of its own). */
export async function searchProfiles(query: string): Promise<Profile[]> {
  if (!query.trim()) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`email.ilike.%${query}%,name.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return data ?? []
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

// ─── Credits ──────────────────────────────────────────────────────────────────

export async function decrementCredits(userId: string) {
  const { error } = await supabase.rpc('decrement_credits', { user_id: userId })
  if (error) throw new Error(error.message)
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

// ─── ERP: Clients ─────────────────────────────────────────────────────────────

/** Admin-wide — every admin shares one client book (RLS already grants any admin full access via is_admin()); filtering by the calling admin's own user_id would silently partition a shared operational record per staff member. */
export async function getERPClients(): Promise<ERPClient[]> {
  const { data, error } = await supabase
    .from('erp_clients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ERPClient[]
}

export async function createERPClient(userId: string, client: Omit<ERPClient, 'id' | 'user_id' | 'created_at'>): Promise<ERPClient> {
  const { data, error } = await supabase
    .from('erp_clients')
    .insert({ ...client, user_id: userId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPClient
}

export async function updateERPClient(id: string, updates: Partial<Omit<ERPClient, 'id' | 'user_id' | 'created_at'>>): Promise<ERPClient> {
  const { data, error } = await supabase
    .from('erp_clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPClient
}

export async function deleteERPClient(id: string) {
  const { error } = await supabase.from('erp_clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── ERP: Orders ──────────────────────────────────────────────────────────────

/** Admin-wide — see getERPClients for why this doesn't filter by the calling admin's own user_id. */
export async function getERPOrders(): Promise<ERPOrder[]> {
  const { data, error } = await supabase
    .from('erp_orders')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ERPOrder[]
}

export async function createERPOrder(userId: string, order: Omit<ERPOrder, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ERPOrder> {
  const { data, error } = await supabase
    .from('erp_orders')
    .insert({ ...order, user_id: userId, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPOrder
}

export async function updateERPOrder(id: string, updates: Partial<Omit<ERPOrder, 'id' | 'user_id' | 'created_at'>>): Promise<ERPOrder> {
  const { data, error } = await supabase
    .from('erp_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPOrder
}

export async function deleteERPOrder(id: string) {
  const { error } = await supabase.from('erp_orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Client-facing: orders placed under this customer's own account, via the erp_orders_customer_read RLS policy. */
export async function getMyERPOrders(customerId: string): Promise<ERPOrder[]> {
  const { data, error } = await supabase
    .from('erp_orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ERPOrder[]
}

// ─── ERP: Deliveries ──────────────────────────────────────────────────────────

/** Admin-wide — see getERPClients for why this doesn't filter by the calling admin's own user_id. */
export async function getERPDeliveries(): Promise<ERPDelivery[]> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ERPDelivery[]
}

export async function createERPDelivery(userId: string, delivery: Omit<ERPDelivery, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ERPDelivery> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .insert({ ...delivery, user_id: userId, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPDelivery
}

export async function updateERPDelivery(id: string, updates: Partial<Omit<ERPDelivery, 'id' | 'order_id' | 'user_id' | 'created_at'>>): Promise<ERPDelivery> {
  const { data, error } = await supabase
    .from('erp_deliveries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ERPDelivery
}

export async function deleteERPDelivery(id: string) {
  const { error } = await supabase.from('erp_deliveries').delete().eq('id', id)
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
  return data as QuoteRequest | null
}

export async function getMyQuoteRequests(customerId: string): Promise<QuoteRequest[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
  return data as QuoteRequest
}

/** Client accepts or rejects a quote that's awaiting their response — enforced server-side via RPC since RLS can't scope which columns a client may touch. */
export async function respondToQuoteRequest(quoteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_quote_request', { p_quote_id: quoteId, p_accept: accept })
  if (error) throw new Error(error.message)
}

/** Re-derives payment truth server-side from a successful payment_transactions row rather than trusting the client. */
export async function markQuoteOrderPaid(quoteId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_quote_order_paid', { p_quote_id: quoteId })
  if (error) throw new Error(error.message)
}

export async function getAllQuoteRequests(): Promise<QuoteRequest[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as QuoteRequest[]
}

export async function updateQuoteRequest(id: string, updates: Partial<Omit<QuoteRequest, 'id' | 'customer_id' | 'created_at'>>): Promise<QuoteRequest> {
  const { data, error } = await supabase
    .from('quote_requests')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
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
  if (quoteErr) throw new Error(quoteErr.message)
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
  if (orderErr) throw new Error(orderErr.message)

  const { error: updateErr } = await supabase
    .from('quote_requests')
    .update({ erp_order_id: order.id, updated_at: new Date().toISOString() })
    .eq('id', quoteId)
  if (updateErr) throw new Error(updateErr.message)

  return order as ERPOrder
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Plan[]
}

export async function getAllPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Plan[]
}

export async function createPlan(plan: Omit<Plan, 'id' | 'created_at' | 'updated_at'>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert({ ...plan, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Plan
}

export async function updatePlan(id: string, updates: Partial<Omit<Plan, 'id' | 'created_at'>>): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Plan
}

export async function deletePlan(id: string) {
  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** The user's most recent subscription regardless of status — not just the active one, so an expired/cancelled plan still displays with its real status badge instead of silently vanishing. */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Subscription | null
}

/**
 * Corrects any subscription/assistant_client rows whose stored status has
 * drifted behind their real, already-passed expiry timestamp — see the
 * subscription_time_sync migration for why this exists (nothing previously
 * flipped status when a billing period simply ran out). Idempotent and safe
 * to call anywhere: it can only ever catch up stale rows to a truth that's
 * already been reached, never expire something early. Pass a userId to
 * scope the sweep to one account (cheap, called on login); omit it for a
 * full sweep (used by admin list pages — the same sweep also runs hourly
 * via pg_cron regardless of whether anyone calls this from the client).
 */
export async function syncSubscriptionStatus(userId?: string): Promise<void> {
  const { error } = await supabase.rpc('sync_subscription_status', { p_user_id: userId ?? null })
  if (error) throw new Error(error.message)
}

export async function createSubscription(sub: Omit<Subscription, 'id' | 'created_at'>): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(sub)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Subscription
}

export async function updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'user_id' | 'created_at'>>): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Subscription
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, profiles(email, name), plans(display_name, type)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Subscription[]
}

// ─── Payment Transactions ─────────────────────────────────────────────────────

export async function createTransaction(tx: Omit<PaymentTransaction, 'id' | 'created_at'>): Promise<PaymentTransaction> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .insert(tx)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PaymentTransaction
}

export async function getUserTransactions(userId: string): Promise<PaymentTransaction[]> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PaymentTransaction[]
}

export async function updateTransaction(id: string, updates: Partial<Omit<PaymentTransaction, 'id' | 'user_id' | 'created_at'>>): Promise<PaymentTransaction> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PaymentTransaction
}

// ─── Credit Balance ───────────────────────────────────────────────────────────

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return data as CreditBalance
}

export async function consumeBasicCredit(userId: string, feature?: string): Promise<{ success: boolean; reason?: string; source?: string }> {
  const { data, error } = await supabase.rpc('consume_basic_credit', {
    p_user_id: userId,
    p_feature: feature ?? null,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; reason?: string; source?: string }
}

export async function consumeAdvancedCredit(userId: string, feature?: string): Promise<{ success: boolean; reason?: string; source?: string }> {
  const { data, error } = await supabase.rpc('consume_advanced_credit', {
    p_user_id: userId,
    p_feature: feature ?? null,
  })
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
  return data as PromoCode | null
}

export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as PromoCode[]
}

export async function createPromoCode(promo: Omit<PromoCode, 'id' | 'created_at' | 'used_count'>): Promise<PromoCode> {
  const { data, error } = await supabase
    .from('promo_codes')
    .insert({ ...promo, used_count: 0 })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PromoCode
}

export async function updatePromoCode(id: string, updates: Partial<Omit<PromoCode, 'id' | 'created_at'>>): Promise<PromoCode> {
  const { data, error } = await supabase
    .from('promo_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as PromoCode
}

// ─── Exchange Rates ───────────────────────────────────────────────────────────

export async function getExchangeRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('base_currency, target_currency, rate')
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
}

// ─── Admin: All Users ─────────────────────────────────────────────────────────

export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId)
  if (error) throw new Error(error.message)
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

export async function getWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const { data, error } = await supabase.from('whatsapp_conversations').select('*').order('last_message_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppConversation[]
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

// ─── Handoff tickets ───────────────────────────────────────────────────────
// A ticket is created/resolved automatically by DB triggers whenever a
// conversation's status flips to/from 'pending_human' — nothing here ever
// inserts one directly, only reads and updates the mutable fields.

/** Every currently-open ticket visible to the caller — cheap (small table), fetched once alongside the conversation list to badge pending_human items with priority without a per-conversation round trip. */
export async function getOpenHandoffTickets(): Promise<HandoffTicket[]> {
  const { data, error } = await supabase.from('handoff_tickets').select('*').eq('status', 'open')
  if (error) throw new Error(error.message)
  return (data ?? []) as HandoffTicket[]
}

/** Owner/manager only (handoff_tickets_own_write) — priority/reason/assignee, never status directly (use resolveHandoffTicket for that, since it's the half that syncs the conversation back). */
export async function updateHandoffTicket(id: string, updates: Partial<Pick<HandoffTicket, 'priority' | 'reason' | 'assigned_to'>>): Promise<HandoffTicket> {
  const { data, error } = await supabase.from('handoff_tickets').update(updates).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as HandoffTicket
}

/** Marks the ticket resolved and — via trg_sync_conversation_from_ticket — flips its conversation back out of pending_human, if it's still there. */
export async function resolveHandoffTicket(id: string, resolvedBy: string): Promise<HandoffTicket> {
  const { data, error } = await supabase
    .from('handoff_tickets')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as HandoffTicket
}

// ─── Usage summary ─────────────────────────────────────────────────────────
// Both RPCs are SECURITY INVOKER — RLS on usage_events itself is what scopes
// the result, not the function body. Numeric columns arrive as strings over
// the wire (JSON has no arbitrary-precision decimal), converted here.

/** One business's own usage since `since` — clientId null means BizKey's own bucket, matching every other client_id convention. */
export async function getUsageSummary(clientId: string | null, since: string): Promise<UsageSummary[]> {
  const { data, error } = await supabase.rpc('get_usage_summary', { p_client_id: clientId, p_since: since })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { event_type: UsageEventType; total_quantity: string; total_cost: string }[])
    .map(r => ({ event_type: r.event_type, total_quantity: Number(r.total_quantity), total_cost: Number(r.total_cost) }))
}

/** Cross-tenant totals grouped by business — admin-only in practice (RLS silently narrows a non-admin caller to just their own client_id). */
export async function getUsageSummaryAllTenants(since: string): Promise<UsageSummaryByTenant[]> {
  const { data, error } = await supabase.rpc('get_usage_summary_all_tenants', { p_since: since })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { client_id: string | null; event_type: UsageEventType; total_quantity: string; total_cost: string }[])
    .map(r => ({ client_id: r.client_id, event_type: r.event_type, total_quantity: Number(r.total_quantity), total_cost: Number(r.total_cost) }))
}

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

export async function getKnowledgeDocuments(clientId: string | null): Promise<KnowledgeDocument[]> {
  let query = supabase.from('knowledge_documents').select('*').order('created_at', { ascending: false })
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeDocument[]
}

export async function getKnowledgeRecords(clientId: string | null): Promise<KnowledgeRecord[]> {
  let query = supabase.from('knowledge_records').select('*').eq('is_active', true)
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeRecord[]
}

/** Uploads the original file to the private knowledge-documents bucket, under {clientId}/{documentId}/{fileName} — that path shape is what the storage RLS policies scope access by. */
export async function uploadKnowledgeDocumentFile(clientId: string, documentId: string, file: File): Promise<string> {
  const path = `${clientId}/${documentId}/${file.name}`
  const { error } = await supabase.storage.from('knowledge-documents').upload(path, file, { upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** Row parsing/mapping happens client-side (see KnowledgeImports UI) — this just persists the already-mapped result. Row count is stamped from the actual insert count, not the caller's claim. */
export async function createKnowledgeDocumentWithRecords(params: {
  clientId: string
  sourceType: 'csv' | 'xlsx'
  title: string
  file: File
  records: KnowledgeRecordData[]
}): Promise<KnowledgeDocument> {
  const documentId = crypto.randomUUID()
  const storagePath = await uploadKnowledgeDocumentFile(params.clientId, documentId, params.file)

  const { data: doc, error: docErr } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      client_id: params.clientId,
      source_type: params.sourceType,
      title: params.title,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      row_count: params.records.length,
      status: 'ready',
    })
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  if (params.records.length > 0) {
    const rows = params.records.map(r => ({
      client_id: params.clientId,
      document_id: documentId,
      record_type: 'product',
      data: r,
      searchable_text: [r.name, r.category, r.description, r.price, r.stock].filter(v => v != null && v !== '').join(' ').toLowerCase(),
    }))
    const { error: recErr } = await supabase.from('knowledge_records').insert(rows)
    if (recErr) throw new Error(recErr.message)
  }

  return doc as KnowledgeDocument
}

export async function getKnowledgeChunks(clientId: string | null): Promise<KnowledgeChunk[]> {
  let query = supabase.from('knowledge_chunks').select('*')
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeChunk[]
}

/** Same shape as createKnowledgeDocumentWithRecords but for unstructured PDF/DOCX text — chunking already happened client-side (see knowledgeImport.ts), this just persists the result. */
export async function createKnowledgeDocumentWithChunks(params: {
  clientId: string
  sourceType: 'pdf' | 'docx'
  title: string
  file: File
  chunks: string[]
}): Promise<KnowledgeDocument> {
  const documentId = crypto.randomUUID()
  const storagePath = await uploadKnowledgeDocumentFile(params.clientId, documentId, params.file)

  const { data: doc, error: docErr } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      client_id: params.clientId,
      source_type: params.sourceType,
      title: params.title,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      row_count: params.chunks.length,
      status: 'ready',
    })
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  if (params.chunks.length > 0) {
    const rows = params.chunks.map((content, index) => ({
      client_id: params.clientId,
      document_id: documentId,
      chunk_index: index,
      content,
    }))
    const { error: chunkErr } = await supabase.from('knowledge_chunks').insert(rows)
    if (chunkErr) throw new Error(chunkErr.message)
  }

  return doc as KnowledgeDocument
}

export async function getKnowledgeRecordsByDocument(documentId: string): Promise<KnowledgeRecord[]> {
  const { data, error } = await supabase.from('knowledge_records').select('*').eq('document_id', documentId).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeRecord[]
}

export async function getKnowledgeChunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase.from('knowledge_chunks').select('*').eq('document_id', documentId).order('chunk_index')
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeChunk[]
}

/** Lets an owner/manager drop a single bad row after reviewing an import, without deleting and re-uploading the whole document. Keeps the parent's cached row_count in sync so the document list doesn't drift from what's actually there. */
export async function deleteKnowledgeRecord(record: KnowledgeRecord, currentRowCount: number): Promise<void> {
  const { error } = await supabase.from('knowledge_records').delete().eq('id', record.id)
  if (error) throw new Error(error.message)
  await supabase.from('knowledge_documents').update({ row_count: Math.max(0, currentRowCount - 1) }).eq('id', record.document_id)
}

export async function deleteKnowledgeChunk(chunk: KnowledgeChunk, currentRowCount: number): Promise<void> {
  const { error } = await supabase.from('knowledge_chunks').delete().eq('id', chunk.id)
  if (error) throw new Error(error.message)
  await supabase.from('knowledge_documents').update({ row_count: Math.max(0, currentRowCount - 1) }).eq('id', chunk.document_id)
}

export async function deleteKnowledgeDocument(doc: KnowledgeDocument) {
  // Best-effort — an orphaned storage object with no surviving DB row is a
  // harmless leak, but a delete blocked by a storage error the user can't
  // otherwise resolve is a real dead end, so the DB row (and its cascaded
  // records) always gets removed regardless of storage outcome.
  await supabase.storage.from('knowledge-documents').remove([doc.storage_path]).catch(() => {})
  const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
}

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

// ─── BizKey Assistant: Plans & Clients ─────────────────────────────────────

export async function getAssistantPlans(): Promise<AssistantPlan[]> {
  const { data, error } = await supabase
    .from('assistant_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AssistantPlan[]
}

export async function getAllAssistantPlans(): Promise<AssistantPlan[]> {
  const { data, error } = await supabase.from('assistant_plans').select('*').order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AssistantPlan[]
}

export async function getAssistantClients(): Promise<AssistantClient[]> {
  const { data, error } = await supabase.from('assistant_clients').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AssistantClient[]
}

export async function createAssistantClient(client: Omit<AssistantClient, 'id' | 'created_at' | 'updated_at'>): Promise<AssistantClient> {
  const { data, error } = await supabase.from('assistant_clients').insert(client).select().single()
  if (error) throw new Error(error.message)
  return data as AssistantClient
}

export async function updateAssistantClient(id: string, updates: Partial<Omit<AssistantClient, 'id' | 'created_at'>>): Promise<AssistantClient> {
  const { data, error } = await supabase
    .from('assistant_clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssistantClient
}

export async function deleteAssistantClient(id: string) {
  const { error } = await supabase.from('assistant_clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** The logged-in customer's own Assistant subscription — null if they've never paid for one. Relies on the additive `assistant_clients_own_read` RLS policy. */
export async function getMyAssistantClient(userId: string): Promise<AssistantClient | null> {
  const { data, error } = await supabase
    .from('assistant_clients')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as AssistantClient | null
}

/**
 * Resolves the caller's business regardless of role — the literal owner
 * (profile_id match) and an invited manager/viewer both go through
 * assistant_client_members now, since a manager/viewer was never findable
 * via getMyAssistantClient's profile_id-only lookup. Used by AuthContext so
 * assistantClient/assistantRole are populated for every team member, not
 * just the original owner.
 */
/**
 * Reads is_admin for the currently-authenticated session directly (no
 * reliance on AuthContext's async profile load, which can lag a beat behind
 * a just-completed signIn) — used right after login to enforce the
 * admin-only vs customer-only login surfaces.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return false
  const { data, error } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).maybeSingle()
  if (error || !data) return false
  return !!data.is_admin
}

export async function getMyAssistantMembership(userId: string): Promise<{ role: AssistantMemberRole; client: AssistantClient } | null> {
  const { data, error } = await supabase
    .from('assistant_client_members')
    .select('role, assistant_clients(*)')
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || !data.assistant_clients) return null
  return { role: data.role as AssistantMemberRole, client: data.assistant_clients as unknown as AssistantClient }
}

/** Team roster for a business — owner-visible in full, but any member can read it (assistant_client_members_own_read). The FK is named explicitly because the table has two FKs into profiles (profile_id, invited_by) and PostgREST can't otherwise pick which one "profile" means. */
export async function getAssistantClientMembers(clientId: string): Promise<AssistantClientMember[]> {
  const { data, error } = await supabase
    .from('assistant_client_members')
    .select('*, profile:profiles!assistant_client_members_profile_id_fkey(name, email)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AssistantClientMember[]
}

/**
 * Owner-only (enforced server-side by invite_assistant_client_member) — the
 * invited person must already have a BizKey account since there's no
 * pending-invite-by-email flow (no way to onboard someone who doesn't have
 * one yet). The notification email is best-effort: send-invite-email
 * failing (bad SMTP creds, mailbox down) never rolls back or fails the
 * invite itself — the membership row is real either way, the person just
 * finds out by logging in instead of by email.
 */
export async function inviteAssistantClientMember(clientId: string, email: string, role: 'manager' | 'viewer'): Promise<AssistantClientMember> {
  const { data, error } = await supabase.rpc('invite_assistant_client_member', {
    p_client_id: clientId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
  const member = data as AssistantClientMember

  supabase.functions.invoke('send-invite-email', { body: { memberId: member.id } })
    .then(({ error: emailError }) => {
      if (emailError) console.warn('send-invite-email failed:', emailError)
    })

  return member
}

/** Owner-only — RLS (assistant_client_members_owner_manage) blocks anyone else, and a trigger blocks demoting the last owner. */
export async function updateAssistantClientMemberRole(memberId: string, role: AssistantMemberRole): Promise<AssistantClientMember> {
  const { data, error } = await supabase
    .from('assistant_client_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as AssistantClientMember
}

/** Owner-only — RLS blocks anyone else, and a trigger blocks removing the last owner. */
export async function removeAssistantClientMember(memberId: string) {
  const { error } = await supabase.from('assistant_client_members').delete().eq('id', memberId)
  if (error) throw new Error(error.message)
}

/** Activates (or upgrades) the caller's own Assistant subscription — server-side re-verifies a successful payment exists for this transaction before writing anything. */
export async function activateAssistantSubscription(transactionId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_assistant_subscription', { p_transaction_id: transactionId })
  if (error) throw new Error(error.message)
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
  if (error) throw new Error(error.message)
  return data as AssistantClient
}

/**
 * Saves one slice of first-run onboarding and, on the final step, stamps
 * onboarding_completed_at. Owner-only — see complete_assistant_onboarding.
 * Every field is optional so each wizard step only sends what it collected.
 */
export async function completeAssistantOnboarding(step: {
  companyName?: string
  sector?: string
  country?: string
  contactPhone?: string
  tone?: AssistantTone
  businessHours?: Record<string, unknown>
  requestedWhatsappNumber?: string
  finish?: boolean
}): Promise<AssistantClient> {
  const { data, error } = await supabase.rpc('complete_assistant_onboarding', {
    p_company_name: step.companyName ?? null,
    p_sector: step.sector ?? null,
    p_country: step.country ?? null,
    p_contact_phone: step.contactPhone ?? null,
    p_tone: step.tone ?? null,
    p_business_hours: step.businessHours ?? null,
    p_requested_whatsapp_number: step.requestedWhatsappNumber ?? null,
    p_finish: step.finish ?? false,
  }).single()
  if (error) throw new Error(error.message)
  return data as AssistantClient
}

/**
 * Admin-only: grants a user a real BizKey Sourcing plan — a subscription
 * replaces the credit pool (expiring any prior active one), a PAYG plan
 * tops up on top of whatever they already have. Same mechanism a real
 * checkout would use, never a hand-typed number.
 */
export async function adminAssignSourcingPlan(userId: string, planId: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_assign_sourcing_plan', { p_user_id: userId, p_plan_id: planId }).single()
  if (error) throw new Error(error.message)
  return data as Profile
}

/** Admin-only: grants (or updates) a user's Assistant subscription. Pass assistantPlanId null to revoke (cancels rather than deletes, so their conversation/FAQ history survives). */
export async function adminAssignAssistantPlan(userId: string, assistantPlanId: string | null): Promise<AssistantClient | null> {
  const { data, error } = await supabase.rpc('admin_assign_assistant_plan', { p_user_id: userId, p_assistant_plan_id: assistantPlanId }).maybeSingle()
  if (error) throw new Error(error.message)
  return data as AssistantClient | null
}


