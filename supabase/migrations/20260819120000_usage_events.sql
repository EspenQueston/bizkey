-- Step 3 of the multi-tenant brief reconciliation: usage_events. Sourcing
-- already has this (usage_logs, from the baseline schema) but Assistant
-- never did — whatsapp_messages.ai_cost has been stamped on every outbound
-- message since the n8n bridge migration, but nothing ever aggregated or
-- displayed it anywhere, for either a business owner or BizKey admin.
-- AssistantBilling.tsx's existing "conversations this month" stat also
-- fetches every conversation and filters client-side in JS rather than
-- aggregating server-side — same inefficiency this fixes for cost too.

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  -- null = BizKey's own, matching the client_id convention already used
  -- across every WhatsApp table.
  client_id uuid references public.assistant_clients(id),
  event_type text not null check (event_type in ('message_inbound', 'message_outbound')),
  quantity numeric not null default 1,
  unit text not null default 'count',
  cost_amount numeric,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_usage_events_client_id on public.usage_events (client_id);
create index idx_usage_events_created_at on public.usage_events (created_at);

-- Populated by trigger, not by any insert path directly — every message,
-- however it lands (real n8n traffic, an admin's manual reply, the
-- simulator), generates exactly one usage_events row this way, so nothing
-- can create a message without also being counted.
create or replace function public.log_usage_event_from_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usage_events (client_id, event_type, quantity, unit, cost_amount, metadata)
  values (
    new.client_id,
    case when new.direction = 'inbound' then 'message_inbound' else 'message_outbound' end,
    1, 'count', new.ai_cost,
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_type', new.sender_type, 'channel', new.channel)
  );
  return new;
end;
$$;

drop trigger if exists trg_log_usage_event_from_message on public.whatsapp_messages;
create trigger trg_log_usage_event_from_message
after insert on public.whatsapp_messages
for each row execute function public.log_usage_event_from_message();

alter table public.usage_events enable row level security;

create policy "usage_events_admin" on public.usage_events for all using (public.is_admin());

-- Read-only for everyone else — usage is a fact about what already
-- happened, not something any role edits. Same all-roles-read shape as
-- every other WhatsApp table.
create policy "usage_events_own_read" on public.usage_events
  for select using (client_id in (select public.my_assistant_client_ids()));

-- Both aggregation helpers are deliberately SECURITY INVOKER (the default —
-- no `security definer` here), unlike almost everything else in this
-- migration set: they run as the CALLING role, so the RLS policies above
-- do the access-control work for free. A non-admin passing someone else's
-- client_id just gets zero matching rows back (an empty/null aggregate),
-- not an error and not another tenant's numbers — no need to hand-roll the
-- same authorization check a second time inside the function body.

-- One business's own usage — what AssistantBilling.tsx needs.
create or replace function public.get_usage_summary(p_client_id uuid, p_since timestamptz)
returns table(event_type text, total_quantity numeric, total_cost numeric)
language sql stable as $$
  select event_type, sum(quantity) as total_quantity, sum(coalesce(cost_amount, 0)) as total_cost
  from public.usage_events
  where client_id is not distinct from p_client_id and created_at >= p_since
  group by event_type
$$;

-- Cross-tenant totals, grouped by business — what the BizKey admin
-- dashboard needs. For a non-admin caller this naturally degrades to just
-- their own single-tenant slice, via the same RLS policy.
create or replace function public.get_usage_summary_all_tenants(p_since timestamptz)
returns table(client_id uuid, event_type text, total_quantity numeric, total_cost numeric)
language sql stable as $$
  select client_id, event_type, sum(quantity) as total_quantity, sum(coalesce(cost_amount, 0)) as total_cost
  from public.usage_events
  where created_at >= p_since
  group by client_id, event_type
$$;
