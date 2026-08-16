-- Fixes two RLS issues discovered while pulling the schema from cloud:
--
-- 1. public.profiles admin policies queried public.profiles from inside
--    their own policy definition (a different alias, but the same table),
--    which Postgres detects as unsafe and rejects with
--    "infinite recursion detected in policy for relation \"profiles\"".
--    This made any RLS-enforced (non service-role) read/update/delete of
--    profiles fail outright. Fixed by moving the admin check into a
--    SECURITY DEFINER helper function, whose internal query runs as the
--    function owner and therefore bypasses RLS instead of re-triggering it.
--
-- 2. public.approved_admins had RLS disabled entirely, so the anon/
--    authenticated roles could read or write the admin allowlist without
--    restriction. Enabled RLS and restricted access to admins only. The
--    handle_new_user() trigger still reads it correctly since it runs
--    SECURITY DEFINER and bypasses RLS.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles" on public.profiles
  for delete using (public.is_admin());

alter table public.approved_admins enable row level security;

create policy "approved_admins_admin_all" on public.approved_admins
  for all using (public.is_admin());

-- 3. Local-only gap found while verifying the above: table-level grants for
--    anon/authenticated/service_role. On hosted Supabase, every project's
--    public schema is pre-provisioned so these roles hold base table
--    privileges and RLS policies are the actual (row-level) security gate.
--    That platform-level default-privilege setup isn't part of a project's
--    own migration history, so reconstructing the schema from scratch here
--    needs it stated explicitly or every anon/authenticated query 42501s
--    before RLS even gets evaluated.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to anon;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
