-- assistant_client_members introduced a 'viewer' role meant to be read-only
-- ("dashboard and analytics, no modification"), but every write policy on
-- the WhatsApp tables gates on my_assistant_client_ids() alone, which
-- returns a client_id regardless of the caller's role — a viewer could
-- currently update conversations, insert messages, and CRUD KB articles /
-- auto-replies exactly like a manager. This closes that gap without
-- touching the read policies (those stay on the all-roles function, since
-- a viewer should still see everything).

create or replace function public.my_assistant_client_write_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.assistant_client_members
  where profile_id = auth.uid() and role in ('owner', 'manager')
$$;

drop policy if exists "whatsapp_conversations_own_update" on public.whatsapp_conversations;
create policy "whatsapp_conversations_own_update" on public.whatsapp_conversations
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));

drop policy if exists "whatsapp_messages_own_insert" on public.whatsapp_messages;
create policy "whatsapp_messages_own_insert" on public.whatsapp_messages
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));

-- whatsapp_kb_articles_own / whatsapp_auto_replies_own were each a single
-- `for all` policy covering read+write together on the all-roles function —
-- split into a read half (unchanged access) and a write half (owner/manager
-- only), dropped and recreated together so there's no window where the
-- broader grant is live without the role restriction.
drop policy if exists "whatsapp_kb_articles_own" on public.whatsapp_kb_articles;
create policy "whatsapp_kb_articles_own_read" on public.whatsapp_kb_articles
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "whatsapp_kb_articles_own_write" on public.whatsapp_kb_articles
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "whatsapp_kb_articles_own_update" on public.whatsapp_kb_articles
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "whatsapp_kb_articles_own_delete" on public.whatsapp_kb_articles
  for delete using (client_id in (select public.my_assistant_client_write_ids()));

drop policy if exists "whatsapp_auto_replies_own" on public.whatsapp_auto_replies;
create policy "whatsapp_auto_replies_own_read" on public.whatsapp_auto_replies
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "whatsapp_auto_replies_own_write" on public.whatsapp_auto_replies
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "whatsapp_auto_replies_own_update" on public.whatsapp_auto_replies
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "whatsapp_auto_replies_own_delete" on public.whatsapp_auto_replies
  for delete using (client_id in (select public.my_assistant_client_write_ids()));
