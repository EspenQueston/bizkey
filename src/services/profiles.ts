// Profiles: the one row every authenticated user has (auth.uid() = id).
// Sourcing-side admin lookups (getAllUsers/setUserAdmin) live here too since
// they operate on the same table, not on a separate "admin" concept.

import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']

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
