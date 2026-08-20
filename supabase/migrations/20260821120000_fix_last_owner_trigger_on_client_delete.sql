-- check_last_assistant_owner (20260817xxxxx-era) correctly blocks removing
-- the last owner member from a business that's still active, but it fired
-- on that same condition even when the member row was being removed only
-- because its parent assistant_clients row was being deleted in the same
-- statement (ON DELETE CASCADE) — so deleting a client with a normal owner
-- membership (i.e. virtually every real business) raised "A business must
-- always have at least one owner" and the whole delete failed. Discovered
-- via a stray admin test row that couldn't be cleaned up through the exact
-- same deleteAssistantClient() path the admin UI's own delete button uses.
--
-- Fix: for the DELETE case, only enforce the invariant when the parent
-- client row still exists — if it's gone (this member row is being
-- cascaded away as part of deleting the whole business), there's no
-- "business without an owner" left to protect. The UPDATE case (changing
-- an owner's role while the business stays active) is untouched.
create or replace function public.check_last_assistant_owner()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' then
    if exists (select 1 from public.assistant_clients where id = old.client_id)
       and not exists (
         select 1 from public.assistant_client_members
         where client_id = old.client_id and role = 'owner' and id <> old.id
       ) then
      raise exception 'A business must always have at least one owner';
    end if;
  elsif tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
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
