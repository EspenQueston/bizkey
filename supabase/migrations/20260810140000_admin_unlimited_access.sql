-- Superadmin unlimited access.
--
-- Admins run the platform, so they must never be metered, charged, or blocked
-- by the credit system. Enforcing that at the database level (rather than only
-- in the edge functions) means every caller — edge functions, the frontend,
-- and any future code path — inherits the bypass automatically and cannot
-- accidentally bill an admin.
--
-- Consumption functions short-circuit to success without decrementing, and the
-- balance function reports an unlimited balance so the UI renders "∞".

-- usage_logs.source previously allowed only 'subscription' | 'payg'. Admin
-- requests are logged with 0 credits consumed so platform analytics stay
-- complete, which needs a third allowed value.
alter table public.usage_logs drop constraint if exists usage_logs_source_check;
alter table public.usage_logs add constraint usage_logs_source_check
  check (source = any (array['subscription'::text, 'payg'::text, 'admin'::text]));

create or replace function public.consume_basic_credit(p_user_id uuid, p_feature text default null::text)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_source text;
begin
  -- Admins: log usage for analytics, but never decrement anything.
  if (select is_admin from profiles where id = p_user_id) then
    insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
    values (p_user_id, null, 'basic', 0, 'admin', p_feature);
    return jsonb_build_object('success', true, 'source', 'admin');
  end if;

  select * into v_sub from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  if found and v_sub.basic_credits_remaining > 0 then
    update subscriptions set basic_credits_remaining = basic_credits_remaining - 1 where id = v_sub.id;
    v_source := 'subscription';
  else
    if (select payg_basic_credits from profiles where id = p_user_id) > 0 then
      update profiles set payg_basic_credits = payg_basic_credits - 1 where id = p_user_id;
      v_source := 'payg';
    else
      return jsonb_build_object('success', false, 'reason', 'no_credits');
    end if;
  end if;

  insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  values (p_user_id, v_sub.id, 'basic', 1, v_source, p_feature);

  return jsonb_build_object('success', true, 'source', v_source);
end;
$function$;

create or replace function public.consume_advanced_credit(p_user_id uuid, p_feature text default null::text)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_source text;
begin
  if (select is_admin from profiles where id = p_user_id) then
    insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
    values (p_user_id, null, 'advanced', 0, 'admin', p_feature);
    return jsonb_build_object('success', true, 'source', 'admin');
  end if;

  select * into v_sub from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  if found and v_sub.advanced_credits_remaining > 0 then
    update subscriptions set advanced_credits_remaining = advanced_credits_remaining - 1 where id = v_sub.id;
    v_source := 'subscription';
  else
    if (select payg_advanced_credits from profiles where id = p_user_id) > 0 then
      update profiles set payg_advanced_credits = payg_advanced_credits - 1 where id = p_user_id;
      v_source := 'payg';
    else
      return jsonb_build_object('success', false, 'reason', 'no_credits');
    end if;
  end if;

  insert into usage_logs (user_id, subscription_id, request_type, credits_consumed, source, feature)
  values (p_user_id, v_sub.id, 'advanced', 1, v_source, p_feature);

  return jsonb_build_object('success', true, 'source', v_source);
end;
$function$;

create or replace function public.get_credit_balance(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_sub record;
  v_profile record;
begin
  -- Admins report as unlimited so the dashboard shows ∞ instead of a number
  -- that would only ever count down toward a limit that doesn't apply.
  if (select is_admin from profiles where id = p_user_id) then
    return jsonb_build_object(
      'unlimited',      true,
      'sub_basic',      -1,
      'sub_advanced',   -1,
      'payg_basic',     -1,
      'payg_advanced',  -1,
      'total_basic',    -1,
      'total_advanced', -1
    );
  end if;

  select basic_credits_remaining, advanced_credits_remaining into v_sub
  from subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;

  select payg_basic_credits, payg_advanced_credits into v_profile
  from profiles where id = p_user_id;

  return jsonb_build_object(
    'unlimited',       false,
    'sub_basic',       coalesce(v_sub.basic_credits_remaining, 0),
    'sub_advanced',    coalesce(v_sub.advanced_credits_remaining, 0),
    'payg_basic',      coalesce(v_profile.payg_basic_credits, 0),
    'payg_advanced',   coalesce(v_profile.payg_advanced_credits, 0),
    'total_basic',     coalesce(v_sub.basic_credits_remaining, 0) + coalesce(v_profile.payg_basic_credits, 0),
    'total_advanced',  coalesce(v_sub.advanced_credits_remaining, 0) + coalesce(v_profile.payg_advanced_credits, 0)
  );
end;
$function$;
