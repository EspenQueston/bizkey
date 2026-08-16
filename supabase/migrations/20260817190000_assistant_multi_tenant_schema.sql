-- BizKey WhatsApp Assistant multi-tenant pivot, part 1: schema.
--
-- assistant_clients becomes the tenant anchor (it already has profile_id
-- with a partial unique index — one owner, at most one business — from the
-- payment-activation work). Every WhatsApp-facing table gets a nullable
-- client_id: NULL means "BizKey's own" (today's only data), never backfilled
-- or moved — zero UPDATEs to existing rows, BizKey's own number/conversations
-- /FAQ keep working exactly as before, visible only via the existing
-- is_admin() policies, since no business owner's predicate can ever match
-- NULL.

alter table public.whatsapp_numbers
  add column if not exists client_id uuid references public.assistant_clients(id);
alter table public.whatsapp_conversations
  add column if not exists client_id uuid references public.assistant_clients(id);
alter table public.whatsapp_messages
  add column if not exists client_id uuid references public.assistant_clients(id);
alter table public.whatsapp_kb_articles
  add column if not exists client_id uuid references public.assistant_clients(id);
alter table public.whatsapp_auto_replies
  add column if not exists client_id uuid references public.assistant_clients(id);
alter table public.whatsapp_contacts
  add column if not exists client_id uuid references public.assistant_clients(id);

create index if not exists idx_whatsapp_numbers_client_id on public.whatsapp_numbers (client_id);
create index if not exists idx_whatsapp_conversations_client_id2 on public.whatsapp_conversations (client_id);
create index if not exists idx_whatsapp_messages_client_id on public.whatsapp_messages (client_id);
create index if not exists idx_whatsapp_kb_articles_client_id on public.whatsapp_kb_articles (client_id);
create index if not exists idx_whatsapp_auto_replies_client_id on public.whatsapp_auto_replies (client_id);

-- MVP simplification: 1 WhatsApp number per business, enforced at the DB
-- level (cheap now, trivially dropped when multi-number support ships).
create unique index if not exists idx_whatsapp_numbers_one_per_client
  on public.whatsapp_numbers (client_id) where client_id is not null;

-- whatsapp_contacts' plain unique(whatsapp_number) becomes wrong once two
-- different businesses can both be messaged by the same real phone number.
-- Replace with an expression index that keeps BizKey's own contacts (NULL
-- bucket) under today's exact guarantee while giving each real tenant an
-- independent uniqueness bucket. This is the one constraint change in this
-- migration; everything else is additive.
alter table public.whatsapp_contacts drop constraint if exists whatsapp_contacts_whatsapp_number_key;
create unique index if not exists idx_whatsapp_contacts_client_number
  on public.whatsapp_contacts (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), whatsapp_number);

-- Every new RLS policy (next migration) calls this instead of a raw
-- `profile_id = auth.uid()` check. Set-returning on purpose: when a
-- members-join-table shows up later (multiple people per business), only
-- this function body changes — every policy that calls it stays identical.
create or replace function public.my_assistant_client_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.assistant_clients where profile_id = auth.uid();
$$;

-- Keeps whatsapp_numbers.client_id (the direction RLS/the sync function
-- actually need) automatically consistent with the existing admin UI's
-- assistant_clients.whatsapp_number_id assignment control, with zero changes
-- to that UI.
create or replace function public.sync_whatsapp_number_client_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.whatsapp_number_id is distinct from new.whatsapp_number_id
     and old.whatsapp_number_id is not null then
    update public.whatsapp_numbers set client_id = null
    where id = old.whatsapp_number_id and client_id = old.id;
  end if;
  if new.whatsapp_number_id is not null then
    update public.whatsapp_numbers set client_id = new.id where id = new.whatsapp_number_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assistant_clients_sync_number on public.assistant_clients;
create trigger trg_assistant_clients_sync_number
after insert or update of whatsapp_number_id on public.assistant_clients
for each row execute function public.sync_whatsapp_number_client_id();

-- Needed because the expression unique index above can't be targeted by
-- supabase-js's `.upsert({ onConflict: 'whatsapp_number' })` — the
-- whatsapp-sync edge function calls this instead.
create or replace function public.upsert_whatsapp_contact(
  p_client_id uuid, p_whatsapp_number text, p_display_name text
) returns public.whatsapp_contacts
language plpgsql security definer set search_path = public as $$
declare v_row public.whatsapp_contacts;
begin
  insert into public.whatsapp_contacts (client_id, whatsapp_number, display_name)
  values (p_client_id, p_whatsapp_number, p_display_name)
  on conflict (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), whatsapp_number)
  do update set display_name = coalesce(excluded.display_name, whatsapp_contacts.display_name)
  returning * into v_row;
  return v_row;
end;
$$;
