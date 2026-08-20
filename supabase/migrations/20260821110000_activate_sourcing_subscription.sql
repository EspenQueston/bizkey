-- Checkout.tsx never actually activated a BizKey Sourcing plan after a
-- successful payment — it marked the transaction 'success' and stopped
-- there, unlike CheckoutAssistant.tsx which calls
-- activate_assistant_subscription (20260817180000_assistant_subscriptions_
-- payment.sql). A paying customer's profile stayed on the free tier's
-- default credits with no subscriptions row, no matter what they bought.
-- This is that same pattern for Sourcing: a SECURITY DEFINER RPC the client
-- calls with its own transaction id, which independently re-verifies a real
-- successful payment exists before granting anything.

alter table public.payment_transactions
  add column if not exists activated_at timestamptz;

create or replace function public.activate_sourcing_subscription(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tx public.payment_transactions;
  v_plan public.plans;
begin
  select * into v_tx
  from public.payment_transactions
  where id = p_transaction_id and user_id = auth.uid();

  if v_tx.id is null then
    raise exception 'Transaction not found';
  end if;

  if v_tx.status <> 'success' or v_tx.plan_id is null then
    raise exception 'No successful sourcing-plan payment found for this transaction';
  end if;

  -- Already granted (e.g. a retried call after a network hiccup, or the
  -- checkout page's polling effect firing more than once) — every other
  -- branch below inserts a subscriptions row or adds PAYG credits, neither
  -- of which is safe to repeat, so this must be a genuine no-op, not an
  -- error a legitimate re-check would surface to the user.
  if v_tx.activated_at is not null then
    return;
  end if;

  select * into v_plan from public.plans where id = v_tx.plan_id and is_active = true;
  if v_plan.id is null then
    raise exception 'Plan not found or inactive';
  end if;

  if v_plan.type = 'subscription' then
    update public.subscriptions
    set status = 'expired'
    where user_id = auth.uid() and status = 'active';

    insert into public.subscriptions (
      user_id, plan_id, status, basic_credits_remaining, advanced_credits_remaining,
      started_at, expires_at, auto_renew, payment_method
    ) values (
      auth.uid(), v_plan.id, 'active', v_plan.basic_credits, v_plan.advanced_credits,
      now(),
      case when v_plan.duration_days is not null then now() + (v_plan.duration_days || ' days')::interval else null end,
      false, v_tx.gateway
    );

    update public.profiles
    set subscription_tier = v_plan.name,
        basic_credits_remaining = v_plan.basic_credits,
        advanced_credits_remaining = v_plan.advanced_credits,
        updated_at = now()
    where id = auth.uid();
  else
    -- PAYG stacks on top of whatever the user already has, same as
    -- admin_assign_sourcing_plan's PAYG branch — never replaces the
    -- subscription pool.
    update public.profiles
    set payg_basic_credits = coalesce(payg_basic_credits, 0) + v_plan.basic_credits,
        payg_advanced_credits = coalesce(payg_advanced_credits, 0) + v_plan.advanced_credits,
        updated_at = now()
    where id = auth.uid();
  end if;

  update public.payment_transactions set activated_at = now() where id = p_transaction_id;

  insert into public.system_events (user_id, event_name, service, status, source, metadata)
  values (auth.uid(), 'checkout_plan_activation', 'billing', 'ok', 'checkout_ui',
          jsonb_build_object('plan_id', v_plan.id, 'plan_name', v_plan.name, 'plan_type', v_plan.type, 'transaction_id', p_transaction_id));
end;
$$;
