-- Step 2 of the multi-tenant brief reconciliation: handoff_tickets.
-- whatsapp_conversations.status already had 'pending_human' as a flag, and
-- .assigned_to existed on the table but was never actually surfaced or
-- writable anywhere in the UI — a human handoff was a status label, not
-- something a team could triage, prioritize, or assign. This makes it real
-- without replacing the status flag: the two stay in sync via triggers in
-- both directions, so nothing that already reads conversation.status breaks.

create table public.handoff_tickets (
  id uuid primary key default gen_random_uuid(),
  -- null = BizKey's own conversation, matching the client_id convention
  -- already used across every WhatsApp table.
  client_id uuid references public.assistant_clients(id),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  reason text,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index idx_handoff_tickets_client_id on public.handoff_tickets (client_id);
create index idx_handoff_tickets_conversation_id on public.handoff_tickets (conversation_id);

-- At most one OPEN ticket per conversation — re-triggering a handoff on a
-- conversation that already has one open must not spawn a duplicate.
-- Resolved tickets stay as history, so this is a partial index, not a
-- plain unique constraint.
create unique index idx_handoff_tickets_one_open_per_conversation
  on public.handoff_tickets (conversation_id) where status = 'open';

-- Conversation -> ticket: flipping status to 'pending_human' opens a
-- ticket automatically; leaving it resolves any open one. SECURITY DEFINER
-- so the insert isn't gated by the acting user's own RLS write access to
-- handoff_tickets (a conversation update is already the thing RLS checks).
create or replace function public.sync_handoff_ticket_from_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_human' and (tg_op = 'INSERT' or old.status is distinct from 'pending_human') then
    insert into public.handoff_tickets (client_id, conversation_id)
    values (new.client_id, new.id)
    on conflict (conversation_id) where status = 'open' do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending_human' and new.status is distinct from 'pending_human' then
    update public.handoff_tickets
    set status = 'resolved', resolved_at = now()
    where conversation_id = new.id and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_handoff_ticket on public.whatsapp_conversations;
create trigger trg_sync_handoff_ticket
after insert or update of status on public.whatsapp_conversations
for each row execute function public.sync_handoff_ticket_from_conversation();

-- Ticket -> conversation, the other direction: resolving a ticket directly
-- (the "Marquer résolu" button) means a human no longer needs to be pulled
-- in, so the conversation should leave pending_human too — but only if
-- it's still actually pending_human (never clobbers a conversation an
-- agent has since closed or already reopened by other means). Guarded so
-- this can never ping-pong with the trigger above: that one's elsif only
-- matches tickets still 'open', so a ticket already 'resolved' here is a
-- no-op there, and this one's UPDATE only fires on status pending_human,
-- so a conversation already 'closed' here is a no-op too.
create or replace function public.sync_conversation_from_handoff_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'resolved' and old.status = 'open' then
    update public.whatsapp_conversations
    set status = 'open'
    where id = new.conversation_id and status = 'pending_human';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_conversation_from_ticket on public.handoff_tickets;
create trigger trg_sync_conversation_from_ticket
after update of status on public.handoff_tickets
for each row execute function public.sync_conversation_from_handoff_ticket();

alter table public.handoff_tickets enable row level security;

create policy "handoff_tickets_admin" on public.handoff_tickets for all using (public.is_admin());

-- Same read/write split as every other WhatsApp table: all roles read,
-- only owner/manager write (viewer stays genuinely read-only). No insert/
-- delete policy for non-admins — tickets are only ever created by the
-- trigger above and kept as history rather than deleted.
create policy "handoff_tickets_own_read" on public.handoff_tickets
  for select using (client_id in (select public.my_assistant_client_ids()));

create policy "handoff_tickets_own_write" on public.handoff_tickets
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));

-- Caught while verifying this migration against a real non-admin owner
-- account, not by inspection: whatsapp_conversations never got an owner/
-- manager INSERT policy — the original multi-tenant migration added
-- _own_read and _own_update for conversations, but not _own_insert
-- (whatsapp_messages did get one, in the viewer-read-only migration).
-- simulateIncomingWhatsAppMessage, the only way to create a test
-- conversation without a real connected WhatsApp number, has therefore
-- been silently admin-only since the multi-tenant pivot, throwing a raw
-- 42501 for any real business owner or manager. A handoff ticket needs a
-- conversation to exist in the first place, so fixing it here rather than
-- filing it separately.
create policy "whatsapp_conversations_own_insert" on public.whatsapp_conversations
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
