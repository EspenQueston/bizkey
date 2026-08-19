-- whatsapp_conversations never got an owner/manager INSERT policy — the
-- original multi-tenant migration added _own_read and _own_update, but not
-- _own_insert (whatsapp_messages did get one, in the viewer-read-only
-- migration). Caught by testing simulateIncomingWhatsAppMessage against a
-- real non-admin owner account, not by inspection: it's the only way to
-- create a test conversation without a real connected WhatsApp number, and
-- has been silently admin-only since the multi-tenant pivot, throwing a raw
-- 42501 for any real business owner or manager.
--
-- drop-if-exists first so this stays safe to apply on a fresh `db reset`
-- too, since 20260819100000_handoff_tickets.sql's own copy of this policy
-- (added there for documentation — the intended migration, written before
-- this gap was caught by live testing) would otherwise collide with it.
drop policy if exists "whatsapp_conversations_own_insert" on public.whatsapp_conversations;
create policy "whatsapp_conversations_own_insert" on public.whatsapp_conversations
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
