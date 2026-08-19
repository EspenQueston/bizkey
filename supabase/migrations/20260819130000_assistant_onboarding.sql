-- Step 4 of the multi-tenant brief reconciliation: guided onboarding.
--
-- activate_assistant_subscription (20260817180000) has always been the ONLY
-- path that ever creates an assistant_clients row, and it fires the instant
-- a payment succeeds — there is no free/trial creation path, by design (see
-- that migration's own comments). company_name is silently defaulted to the
-- payer's profile name/email at that moment, and CheckoutAssistant.tsx's
-- "done" step just links to /app/assistant with zero guidance — tone,
-- business hours, WhatsApp number request, team invites and FAQs already
-- exist as real, working settings, but a brand-new owner has to go
-- discover each one on their own. This adds the two missing pieces: real
-- company identity fields nobody ever actually asked the owner for, and a
-- completion marker the frontend uses to gate a first-run wizard.

alter table public.assistant_clients
  add column if not exists sector text,
  add column if not exists country text,
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill: a business that already set real business_hours or requested a
-- WhatsApp number clearly already went through Settings on its own — don't
-- retroactively force it through the new wizard. Only genuinely untouched
-- rows (defaulted company_name, nothing ever configured) stay gated.
update public.assistant_clients
set onboarding_completed_at = created_at
where onboarding_completed_at is null
  and (business_hours is not null or requested_whatsapp_number is not null);

-- Deliberately a separate RPC from update_my_assistant_settings rather than
-- widening it: "finish first-run setup" is a distinct, one-shot operation
-- (it also writes company identity fields Settings never touches), and
-- every param defaults to null/false so each wizard step can save just its
-- own slice via coalesce, ending with p_finish := true on the last step.
-- Owner-only, same as billing — company legal identity is an owner-level
-- decision, not something a manager should be able to change.
create or replace function public.complete_assistant_onboarding(
  p_company_name text default null,
  p_sector text default null,
  p_country text default null,
  p_contact_phone text default null,
  p_tone text default null,
  p_business_hours jsonb default null,
  p_requested_whatsapp_number text default null,
  p_finish boolean default false
) returns public.assistant_clients
language plpgsql security definer set search_path = public as $$
declare
  v_row public.assistant_clients;
  v_client_id uuid;
begin
  select client_id into v_client_id
  from public.assistant_client_members
  where profile_id = auth.uid() and role = 'owner'
  limit 1;

  if v_client_id is null then
    raise exception 'No assistant subscription found for this account, or you are not the owner';
  end if;

  update public.assistant_clients
  set company_name = coalesce(p_company_name, company_name),
      sector = coalesce(p_sector, sector),
      country = coalesce(p_country, country),
      contact_phone = coalesce(p_contact_phone, contact_phone),
      tone = coalesce(p_tone, tone),
      business_hours = coalesce(p_business_hours, business_hours),
      requested_whatsapp_number = coalesce(p_requested_whatsapp_number, requested_whatsapp_number),
      onboarding_completed_at = case when p_finish then now() else onboarding_completed_at end,
      updated_at = now()
  where id = v_client_id
  returning * into v_row;

  return v_row;
end;
$$;
