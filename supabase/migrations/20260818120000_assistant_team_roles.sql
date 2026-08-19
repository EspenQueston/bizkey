-- BizKey Assistant, step 1 of the multi-tenant brief reconciliation: team
-- roles. Today a business has exactly one person who can ever touch it —
-- assistant_clients.profile_id, unique, checked directly by RLS and by
-- update_my_assistant_settings. This adds real team membership (owner /
-- manager / viewer) on top of that, without changing what profile_id means
-- or touching a single existing row: every current owner is backfilled into
-- the new table as 'owner', and my_assistant_client_ids() — the one function
-- nearly every WhatsApp RLS policy already calls — is repointed at
-- membership instead of the raw column. Every policy that calls it inherits
-- team support with zero changes of its own.

create table public.assistant_client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.assistant_clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager', 'viewer')),
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  -- V1 scope, matching the existing one-business-per-owner constraint: a
  -- person belongs to at most one BizKey Assistant business, at one role.
  -- Multi-business membership (e.g. an agency managing several clients)
  -- is a real future need but changes AuthContext's assistantClient from a
  -- single object to a list — out of scope for this pass.
  unique (profile_id),
  unique (client_id, profile_id)
);

create index idx_assistant_client_members_client_id on public.assistant_client_members (client_id);

insert into public.assistant_client_members (client_id, profile_id, role)
select id, profile_id, 'owner' from public.assistant_clients
where profile_id is not null
on conflict (profile_id) do nothing;

-- Keeps the owner row in assistant_client_members automatically consistent
-- with assistant_clients.profile_id, the same way sync_whatsapp_number_
-- client_id already keeps whatsapp_numbers.client_id consistent with
-- assistant_clients.whatsapp_number_id — so admin_assign_assistant_plan's
-- existing insert/on-conflict-update path (which sets profile_id once, on
-- first grant) needs no changes at all.
create or replace function public.sync_assistant_client_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null then
    insert into public.assistant_client_members (client_id, profile_id, role)
    values (new.id, new.profile_id, 'owner')
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assistant_clients_sync_owner on public.assistant_clients;
create trigger trg_assistant_clients_sync_owner
after insert or update of profile_id on public.assistant_clients
for each row execute function public.sync_assistant_client_owner();

-- A business must always have at least one owner — block removing or
-- demoting the last one rather than silently leaving the business unowned.
create or replace function public.check_last_assistant_owner()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    if not exists (
      select 1 from public.assistant_client_members
      where client_id = old.client_id and role = 'owner' and id <> old.id
    ) then
      raise exception 'A business must always have at least one owner';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_check_last_assistant_owner on public.assistant_client_members;
create trigger trg_check_last_assistant_owner
before update or delete on public.assistant_client_members
for each row execute function public.check_last_assistant_owner();

-- The single integration point: every existing RLS policy across
-- whatsapp_numbers/conversations/messages/kb_articles/auto_replies/contacts
-- already gates on "client_id in (select my_assistant_client_ids())" —
-- repointing this one function at membership instead of the raw column is
-- the entire mechanism by which those policies gain team support.
create or replace function public.my_assistant_client_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.assistant_client_members where profile_id = auth.uid()
$$;

-- assistant_clients itself only ever granted read to the literal owner
-- (assistant_clients_own_read, auth.uid() = profile_id) — additive policy
-- so a manager/viewer can read their business's own row too.
create policy "assistant_clients_member_read" on public.assistant_clients
  for select using (id in (select public.my_assistant_client_ids()));

alter table public.assistant_client_members enable row level security;

create policy "assistant_client_members_admin" on public.assistant_client_members
  for all using (public.is_admin());

-- Any team member can see their own team roster.
create policy "assistant_client_members_own_read" on public.assistant_client_members
  for select using (client_id in (select public.my_assistant_client_ids()));

-- Only the acting owner can add/change/remove members — a manager or
-- viewer matches no row here (their own row only satisfies the read policy
-- above), so they cannot self-escalate or touch teammates at all.
create policy "assistant_client_members_owner_manage" on public.assistant_client_members
  for all using (
    exists (
      select 1 from public.assistant_client_members m
      where m.client_id = assistant_client_members.client_id
        and m.profile_id = auth.uid() and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.assistant_client_members m
      where m.client_id = assistant_client_members.client_id
        and m.profile_id = auth.uid() and m.role = 'owner'
    )
  );

-- Invite by email — SECURITY DEFINER because a non-admin owner has no RLS
-- read access to other people's profiles (searchProfiles() is explicitly
-- admin-only for the same reason), so resolving email -> profile_id can
-- only happen inside a function that intentionally bypasses that.
-- No email-sending exists in this project yet, so this only works for a
-- person who already has a BizKey account — the honest V1 scope, not a
-- full pending-invite flow that would need infrastructure that isn't there.
create or replace function public.invite_assistant_client_member(
  p_client_id uuid, p_email text, p_role text
) returns public.assistant_client_members
language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
  v_row public.assistant_client_members;
begin
  if p_role not in ('manager', 'viewer') then
    raise exception 'Only manager or viewer can be invited — ownership transfers separately';
  end if;

  if not (public.is_admin() or exists (
    select 1 from public.assistant_client_members m
    where m.client_id = p_client_id and m.profile_id = auth.uid() and m.role = 'owner'
  )) then
    raise exception 'Only the business owner can invite members';
  end if;

  select id into v_profile_id from public.profiles where email = lower(trim(p_email));
  if v_profile_id is null then
    raise exception 'No BizKey account found for this email — the person must create an account first';
  end if;

  if exists (select 1 from public.assistant_client_members where profile_id = v_profile_id) then
    raise exception 'This person already belongs to a BizKey Assistant team';
  end if;

  insert into public.assistant_client_members (client_id, profile_id, role, invited_by)
  values (p_client_id, v_profile_id, p_role, auth.uid())
  returning * into v_row;

  insert into public.system_events (user_id, event_name, service, status, source, metadata)
  values (auth.uid(), 'assistant_member_invited', 'assistant', 'ok', 'app_ui',
          jsonb_build_object('client_id', p_client_id, 'invited_profile_id', v_profile_id, 'role', p_role));

  return v_row;
end;
$$;

-- Widen self-service settings from "the literal owner" to "owner or
-- manager", matching the role's stated scope (a manager gets "assistant,
-- FAQ" access per the product brief). Still never touches plan_id/status.
create or replace function public.update_my_assistant_settings(
  p_tone text, p_business_hours jsonb, p_requested_whatsapp_number text
) returns public.assistant_clients
language plpgsql security definer set search_path = public as $$
declare
  v_row public.assistant_clients;
  v_client_id uuid;
begin
  select client_id into v_client_id
  from public.assistant_client_members
  where profile_id = auth.uid() and role in ('owner', 'manager')
  limit 1;

  if v_client_id is null then
    raise exception 'No assistant subscription found for this account, or you do not have edit access';
  end if;

  update public.assistant_clients
  set tone = coalesce(p_tone, tone),
      business_hours = p_business_hours,
      requested_whatsapp_number = p_requested_whatsapp_number,
      updated_at = now()
  where id = v_client_id
  returning * into v_row;

  return v_row;
end;
$$;
