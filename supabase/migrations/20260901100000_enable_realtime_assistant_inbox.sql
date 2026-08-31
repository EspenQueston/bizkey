-- Enables Supabase Realtime for the WhatsApp Assistant inbox.
--
-- Nothing in the frontend has ever subscribed to postgres_changes, and
-- (independently) none of these tables were in the supabase_realtime
-- publication either — so even a client that did subscribe would have
-- received nothing. This migration is the missing half; the frontend
-- subscription is added in the same change that ships this file.
--
-- REPLICA IDENTITY FULL is set so UPDATE/DELETE payloads carry the full old
-- row (not just the primary key) — needed to diff what changed on an UPDATE
-- (e.g. a conversation's status flipping to pending_human) without a
-- separate fetch.
alter table public.whatsapp_conversations replica identity full;
alter table public.whatsapp_messages       replica identity full;
alter table public.handoff_tickets         replica identity full;
alter table public.whatsapp_numbers        replica identity full;

alter publication supabase_realtime add table
  public.whatsapp_conversations,
  public.whatsapp_messages,
  public.handoff_tickets,
  public.whatsapp_numbers;
