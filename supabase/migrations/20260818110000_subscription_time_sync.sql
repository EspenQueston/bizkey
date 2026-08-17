-- Neither BizKey Sourcing subscriptions nor Assistant clients ever
-- automatically reflected the passage of time: subscriptions.status and
-- assistant_clients.status only ever changed via an explicit action (a
-- purchase, an admin grant/revoke) — nothing flipped them when the billing
-- period they were granted actually ran out. Credit consumption on the
-- Sourcing side already independently re-checks expires_at at the point of
-- use (see consume_basic_credit/consume_advanced_credit), so functional
-- access was never wrong there — but the STORED status, and everything
-- that displays it (admin's Clients list, the user's own Abonnement page,
-- the sidebar's plan badge via profiles.subscription_tier), could silently
-- drift from reality for as long as nobody took a new action on the account.

-- 'expired' didn't exist as a distinct outcome from 'cancelled' — an admin
-- explicitly revoking access and a business simply not renewing are
-- different things and shouldn't share one label.
alter table public.assistant_clients drop constraint assistant_clients_status_check;
alter table public.assistant_clients add constraint assistant_clients_status_check
  check (status = any (array['trial','active','suspended','cancelled','expired']));

-- Idempotent and safe to call from anywhere, by anyone: it only ever flips
-- a row whose real, already-stored expiry timestamp has already passed —
-- it can't be used to expire something early or un-expire something, so it
-- needs no admin/self guard. p_user_id narrows the sweep to one account
-- (cheap, called on login so a returning user's own state is correct
-- before anything reads it); left null it's a full sweep (cheap at this
-- table size — used by the admin list pages and the hourly cron job below).
create or replace function public.sync_subscription_status(p_user_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subs_expired integer;
  v_assistant_expired integer;
begin
  update public.subscriptions
  set status = 'expired'
  where status = 'active'
    and expires_at is not null and expires_at <= now()
    and (p_user_id is null or user_id = p_user_id);
  get diagnostics v_subs_expired = row_count;

  update public.profiles p
  set subscription_tier = 'free', updated_at = now()
  where p.subscription_tier <> 'free'
    and (p_user_id is null or p.id = p_user_id)
    and not exists (
      select 1 from public.subscriptions s
      where s.user_id = p.id and s.status = 'active'
        and (s.expires_at is null or s.expires_at > now())
    );

  update public.assistant_clients
  set status = 'expired', updated_at = now()
  where status = 'active'
    and current_period_end is not null and current_period_end <= now()
    and (p_user_id is null or profile_id = p_user_id);
  get diagnostics v_assistant_expired = row_count;

  if v_subs_expired > 0 or v_assistant_expired > 0 then
    insert into public.system_events (event_name, service, status, source, metadata)
    values ('subscription_status_sync', 'billing', 'ok', 'sync_subscription_status',
            jsonb_build_object(
              'subscriptions_expired', v_subs_expired,
              'assistant_clients_expired', v_assistant_expired,
              'scope', coalesce(p_user_id::text, 'all')
            ));
  end if;
end;
$$;

-- Hourly background sweep — correctness doesn't actually depend on this
-- running (AuthContext calls the scoped version on every login, and the
-- Assistant route guards independently re-check current_period_end
-- regardless of what the stored status says), but it's what keeps an
-- account nobody has looked at in a while from sitting with a stale
-- "Actif" label indefinitely.
create extension if not exists pg_cron;

select cron.schedule(
  'sync-subscription-status',
  '0 * * * *',
  $$select public.sync_subscription_status()$$
);
