-- assistant_clients had no way to answer "since when is this business a
-- paying subscriber" or "when does their current period end" — every
-- Assistant plan is billed monthly, but nothing tracked the cycle the way
-- subscriptions.started_at/expires_at already does for BizKey Sourcing.
-- Real columns, set by both activation paths (self-service checkout and
-- admin grant), not derived/guessed from created_at.

alter table public.assistant_clients
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz;

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

  insert into public.assistant_clients (profile_id, company_name, contact_name, contact_email, plan_id, status, current_period_start, current_period_end)
  select auth.uid(), coalesce(p.name, p.email, 'Client BizKey'), p.name, p.email, v_plan_id, 'active', now(), now() + interval '30 days'
  from public.profiles p
  where p.id = auth.uid()
  on conflict (profile_id) where profile_id is not null
  do update set plan_id = excluded.plan_id, status = 'active',
                current_period_start = now(), current_period_end = now() + interval '30 days',
                updated_at = now();
end;
$$;

create or replace function public.admin_assign_assistant_plan(p_user_id uuid, p_assistant_plan_id uuid)
returns public.assistant_clients
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.assistant_plans;
  v_row public.assistant_clients;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_assistant_plan_id is null then
    update public.assistant_clients
    set status = 'cancelled', updated_at = now()
    where profile_id = p_user_id
    returning * into v_row;

    insert into public.system_events (user_id, event_name, service, status, source, metadata)
    values (auth.uid(), 'admin_assistant_revoke', 'assistant', 'ok', 'admin_users_ui',
            jsonb_build_object('target_user_id', p_user_id));

    return v_row;
  end if;

  select * into v_plan from public.assistant_plans where id = p_assistant_plan_id and is_active = true;
  if v_plan.id is null then
    raise exception 'Assistant plan not found or inactive';
  end if;

  insert into public.assistant_clients (profile_id, company_name, contact_name, contact_email, plan_id, status, current_period_start, current_period_end)
  select p_user_id, coalesce(p.name, p.email, 'Client BizKey'), p.name, p.email, v_plan.id, 'active', now(), now() + interval '30 days'
  from public.profiles p
  where p.id = p_user_id
  on conflict (profile_id) where profile_id is not null
  do update set plan_id = excluded.plan_id, status = 'active',
                current_period_start = now(), current_period_end = now() + interval '30 days',
                updated_at = now()
  returning * into v_row;

  insert into public.system_events (user_id, event_name, service, status, source, metadata)
  values (auth.uid(), 'admin_plan_grant', 'assistant', 'ok', 'admin_users_ui',
          jsonb_build_object('target_user_id', p_user_id, 'assistant_plan_id', v_plan.id, 'plan_name', v_plan.name));

  return v_row;
end;
$$;
