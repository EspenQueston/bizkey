// WhatsApp Assistant: human-handoff tickets. A ticket is created/resolved
// automatically by DB triggers whenever a conversation's status flips
// to/from 'pending_human' — nothing here ever inserts one directly, only
// reads and updates the mutable fields.

import { supabase } from '../lib/supabase'
import type { HandoffTicket } from '../lib/supabase'

// A ticket is created/resolved automatically by DB triggers whenever a
// conversation's status flips to/from 'pending_human' — nothing here ever
// inserts one directly, only reads and updates the mutable fields.

/** Every currently-open ticket visible to the caller — cheap (small table), fetched once alongside the conversation list to badge pending_human items with priority without a per-conversation round trip. */
export async function getOpenHandoffTickets(): Promise<HandoffTicket[]> {
  const { data, error } = await supabase.from('handoff_tickets').select('*').eq('status', 'open')
  if (error) throw new Error(error.message)
  return (data ?? []) as HandoffTicket[]
}

/** Every ticket ever raised since `since`, open or resolved — the denominator for a real "% of conversations that needed a human" figure, not just the currently-open count. */
export async function getHandoffTicketsCountSince(clientId: string | null, since: string): Promise<number> {
  let query = supabase.from('handoff_tickets').select('id', { count: 'exact', head: true }).gte('created_at', since)
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
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
