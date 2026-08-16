-- Business self-service portal settings: tone, hours, and a "request this
-- number" field the owner fills in that surfaces in the existing admin
-- AssistantClients.tsx assignment dropdown for manual approval — this *is*
-- the MVP's "connect and verify your WhatsApp number" flow, no new
-- Evolution API self-service provisioning needed.

alter table public.assistant_clients
  add column if not exists tone text check (tone in ('professional', 'friendly', 'commercial')) default 'professional',
  add column if not exists business_hours jsonb,
  add column if not exists requested_whatsapp_number text;

-- Owner can update their own tone/hours/number-request, never plan_id or
-- status directly (those stay admin/RPC-only — see activate_assistant_
-- subscription for why a raw client-writable UPDATE policy on the whole
-- row would be a billing-bypass risk).
create or replace function public.update_my_assistant_settings(
  p_tone text, p_business_hours jsonb, p_requested_whatsapp_number text
) returns public.assistant_clients
language plpgsql security definer set search_path = public as $$
declare v_row public.assistant_clients;
begin
  update public.assistant_clients
  set tone = coalesce(p_tone, tone),
      business_hours = p_business_hours,
      requested_whatsapp_number = p_requested_whatsapp_number,
      updated_at = now()
  where profile_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No assistant subscription found for this account';
  end if;
  return v_row;
end;
$$;
