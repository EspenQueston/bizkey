// WhatsApp Assistant: assistant_clients — the "organization" a subscriber's
// business maps to (see the architecture brief's organizations table; this
// codebase named it assistant_clients before that brief existed) — plan
// catalog, membership/roles, onboarding, and settings.

import { supabase } from '../lib/supabase'
import type { AssistantPlan, AssistantClient, AssistantTone, AssistantClientMember, AssistantMemberRole } from '../lib/supabase'
import type { Profile } from './profiles'

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

/** Same as activateAssistantSubscription but for BizKey Sourcing — grants the subscription/PAYG credits the caller's own successful payment paid for. Idempotent: a repeat call for an already-activated transaction is a safe no-op, not a double-grant. */
export async function activateSourcingSubscription(transactionId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_sourcing_subscription', { p_transaction_id: transactionId })
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
