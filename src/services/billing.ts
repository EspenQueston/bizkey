// BizKey Sourcing billing: subscriptions, payment transactions, the two
// credit pools (basic/advanced), promo codes and CNY exchange rates. Grouped
// together because they're all read by the same admin Commercial pages and
// the customer-facing billing surfaces.

import { supabase } from '../lib/supabase'
import type { Subscription, PaymentTransaction, PromoCode, CreditBalance } from '../lib/supabase'

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

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return data as CreditBalance
}

export async function decrementCredits(userId: string) {
  const { error } = await supabase.rpc('decrement_credits', { user_id: userId })
  if (error) throw new Error(error.message)
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
