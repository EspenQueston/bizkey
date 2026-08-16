-- Self-service payment for BizKey WhatsApp Assistant plans. assistant_clients
-- was originally an admin-managed CRM contact book (mirroring erp_clients);
-- this adds the missing link to a real authenticated website account so a
-- logged-in customer can pay for their own Assistant subscription, the same
-- way quote_requests added erp_orders.customer_id for Sourcing.

alter table public.assistant_clients
  add column if not exists profile_id uuid references public.profiles(id);

create unique index if not exists idx_assistant_clients_profile_id_unique
  on public.assistant_clients (profile_id)
  where profile_id is not null;

alter table public.payment_transactions
  add column if not exists assistant_plan_id uuid references public.assistant_plans(id);

-- Additive, read-only — the existing admin "for all" policy is untouched,
-- so this can only ever grant a client visibility into their own row, never
-- write access to someone else's.
create policy "assistant_clients_own_read" on public.assistant_clients
  for select using (auth.uid() = profile_id);

-- Client-writable state transition goes through a SECURITY DEFINER RPC
-- rather than a direct UPDATE policy, same pattern as
-- respond_to_quote_request/mark_quote_order_paid: the RPC independently
-- re-verifies a successful payment exists before activating anything,
-- so a client calling this directly without having paid gets rejected.
create or replace function public.activate_assistant_subscription(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid;
begin
  select assistant_plan_id into v_plan_id
  from public.payment_transactions
  where id = p_transaction_id
    and user_id = auth.uid()
    and status = 'success'
    and assistant_plan_id is not null;

  if v_plan_id is null then
    raise exception 'No successful assistant-plan payment found for this transaction';
  end if;

  insert into public.assistant_clients (profile_id, company_name, contact_name, contact_email, plan_id, status)
  select auth.uid(), coalesce(p.name, p.email, 'Client BizKey'), p.name, p.email, v_plan_id, 'active'
  from public.profiles p
  where p.id = auth.uid()
  on conflict (profile_id) where profile_id is not null
  do update set plan_id = excluded.plan_id, status = 'active', updated_at = now();
end;
$$;
