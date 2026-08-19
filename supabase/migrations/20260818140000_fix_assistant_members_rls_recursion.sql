-- assistant_client_members_owner_manage's USING/CHECK clauses queried
-- assistant_client_members directly (a same-table subquery), which runs as
-- SECURITY INVOKER by default — evaluating it for the calling user requires
-- re-checking RLS on the rows being scanned, which re-invokes this exact
-- policy, forever: "infinite recursion detected in policy for relation
-- assistant_client_members" (Postgres error 42P17), caught live while
-- testing the owner's own Settings page load.
--
-- my_assistant_client_ids() never hit this because it's SECURITY DEFINER,
-- owned by the migration role that owns the table — its internal query
-- bypasses RLS entirely rather than re-entering it. Same fix here: wrap the
-- "is this caller an owner of this client_id" check in a SECURITY DEFINER
-- function so the policy's own subquery never re-triggers itself.

create or replace function public.is_assistant_client_owner(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assistant_client_members
    where client_id = p_client_id and profile_id = auth.uid() and role = 'owner'
  )
$$;

drop policy if exists "assistant_client_members_owner_manage" on public.assistant_client_members;
create policy "assistant_client_members_owner_manage" on public.assistant_client_members
  for all using (public.is_assistant_client_owner(client_id))
  with check (public.is_assistant_client_owner(client_id));

-- check_last_assistant_owner had the same latent issue one layer down: as
-- SECURITY INVOKER (the default — no `security definer` was on it), its
-- internal SELECT ran under the acting user's own RLS view rather than
-- bypassing it. In practice RLS still only ever let an owner reach this
-- trigger, and the read policy lets an owner see every row for their own
-- client_id, so it happened to return correct results — but that correctness
-- depended on the read policy's exact shape rather than being guaranteed,
-- and it shared the same table with the policy that WAS actually recursing.
-- Marking it SECURITY DEFINER removes that dependency the same way every
-- other cross-row check in this migration set already does.
create or replace function public.check_last_assistant_owner()
returns trigger language plpgsql security definer set search_path = public as $$
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
