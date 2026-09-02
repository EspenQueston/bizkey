// Sourcing ERP: quote requests, including the one place a QuoteRequest turns
// into a real ERPOrder (convertQuoteToOrder).

import { supabase } from '../lib/supabase'
import type { ERPOrder, ERPCountry, QuoteRequest } from '../lib/supabase'

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
