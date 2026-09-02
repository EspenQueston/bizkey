// WhatsApp Assistant: usage/cost rollups. Both RPCs are SECURITY INVOKER —
// RLS on usage_events itself is what scopes the result, not the function
// body. Numeric columns arrive as strings over the wire (JSON has no
// arbitrary-precision decimal), converted here.

import { supabase } from '../lib/supabase'
import type { UsageEventType, UsageSummary, UsageSummaryByTenant } from '../lib/supabase'

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
