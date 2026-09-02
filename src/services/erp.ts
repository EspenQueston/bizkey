// Sourcing ERP: clients, orders and deliveries for the fulfilment side of
// BizKey Sourcing (distinct from the WhatsApp Assistant's own "clients" —
// assistant_clients — see services/assistantClients.ts).

import { supabase } from '../lib/supabase'
import type { ERPClient, ERPOrder, ERPDelivery } from '../lib/supabase'

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
