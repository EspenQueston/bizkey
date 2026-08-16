-- Replaces the admin's free-typed credit fields (Crédits legacy/Basic/
-- Advanced/PAYG Basic on the Edit User modal) with real plan-driven grants.
-- Those fields let an admin type any number with zero connection to what a
-- real plan actually grants — this makes the same two mechanisms real
-- customers go through (a subscription's fixed credit pool, a PAYG pack's
-- stackable top-up) the only way credits move, whether triggered by a real
-- payment or an admin's manual grant.
--
-- profiles.subscription_tier was constrained to a stale enum
-- ('free'|'basic'|'pro') that doesn't match any real plans.name value
-- ('free'|'standard' today) — it's a denormalized display cache, not an
-- independent source of truth, so the constraint is dropped and this
-- migration becomes its only writer going forward.
alter table public.profiles drop constraint if exists profiles_subscription_tier_check;

-- ─── BizKey Sourcing ─────────────────────────────────────────────────────

create or replace function public.admin_assign_sourcing_plan(p_user_id uuid, p_plan_id uuid)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.plans;
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active = true;
  if v_plan.id is null then
    raise exception 'Plan not found or inactive';
  end if;

  if v_plan.type = 'subscription' then
    -- Exactly one active subscription per user — expire any previous one
    -- before the new plan's pool replaces it (a subscription's credits are
    -- what the plan grants, not an accumulation across plan changes).
    update public.subscriptions
    set status = 'expired'
    where user_id = p_user_id and status = 'active';

    insert into public.subscriptions (
      user_id, plan_id, status, basic_credits_remaining, advanced_credits_remaining,
      started_at, expires_at, auto_renew, payment_method
    ) values (
      p_user_id, v_plan.id, 'active', v_plan.basic_credits, v_plan.advanced_credits,
      now(),
      case when v_plan.duration_days is not null then now() + (v_plan.duration_days || ' days')::interval else null end,
      false, 'admin_grant'
    );

    update public.profiles
    set subscription_tier = v_plan.name,
        basic_credits_remaining = v_plan.basic_credits,
        advanced_credits_remaining = v_plan.advanced_credits,
        updated_at = now()
    where id = p_user_id;
  else
    -- PAYG stacks on top of whatever the user already has, exactly like a
    -- real PAYG purchase would — never replaces the subscription pool.
    update public.profiles
    set payg_basic_credits = coalesce(payg_basic_credits, 0) + v_plan.basic_credits,
        payg_advanced_credits = coalesce(payg_advanced_credits, 0) + v_plan.advanced_credits,
        updated_at = now()
    where id = p_user_id;
  end if;

  insert into public.system_events (user_id, event_name, service, status, source, metadata)
  values (auth.uid(), 'admin_plan_grant', 'billing', 'ok', 'admin_users_ui',
          jsonb_build_object('target_user_id', p_user_id, 'plan_id', v_plan.id, 'plan_name', v_plan.name, 'plan_type', v_plan.type));

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

-- ─── BizKey WhatsApp Assistant ───────────────────────────────────────────

-- p_assistant_plan_id null means "revoke" — cancels the existing row rather
-- than deleting it, so conversation/FAQ history a business already built up
-- isn't destroyed by an admin toggling their access off.
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

  insert into public.assistant_clients (profile_id, company_name, contact_name, contact_email, plan_id, status)
  select p_user_id, coalesce(p.name, p.email, 'Client BizKey'), p.name, p.email, v_plan.id, 'active'
  from public.profiles p
  where p.id = p_user_id
  on conflict (profile_id) where profile_id is not null
  do update set plan_id = excluded.plan_id, status = 'active', updated_at = now()
  returning * into v_row;

  insert into public.system_events (user_id, event_name, service, status, source, metadata)
  values (auth.uid(), 'admin_plan_grant', 'assistant', 'ok', 'admin_users_ui',
          jsonb_build_object('target_user_id', p_user_id, 'assistant_plan_id', v_plan.id, 'plan_name', v_plan.name));

  return v_row;
end;
$$;
