-- BizKey WhatsApp Assistant multi-tenant pivot, part 2: RLS.
--
-- Every policy below is additive alongside the existing `is_admin()`-only
-- policy, with one deliberate, disclosed exception (whatsapp_kb_articles'
-- public-read policy) explained inline below.

-- ── Read-only for the owner: numbers, contacts ──────────────────────────
create policy "whatsapp_numbers_own_read" on public.whatsapp_numbers
  for select using (client_id in (select public.my_assistant_client_ids()));

create policy "whatsapp_contacts_own_read" on public.whatsapp_contacts
  for select using (client_id in (select public.my_assistant_client_ids()));

-- ── Conversations/messages: read + the same limited write admin already
-- has (agent replies, status changes) — this is a DB-only write, it doesn't
-- itself call Evolution API (that gap already exists for admin's own reply
-- button today; extending the same capability to a business owner isn't a
-- new gap, and directly serves "reprendre une conversation manuellement"). ─
create policy "whatsapp_conversations_own_read" on public.whatsapp_conversations
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "whatsapp_conversations_own_update" on public.whatsapp_conversations
  for update using (client_id in (select public.my_assistant_client_ids()))
  with check (client_id in (select public.my_assistant_client_ids()));

create policy "whatsapp_messages_own_read" on public.whatsapp_messages
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "whatsapp_messages_own_insert" on public.whatsapp_messages
  for insert with check (client_id in (select public.my_assistant_client_ids()));

-- ── FAQ/auto-reply settings: full CRUD for the owner — pure self-service
-- data, nothing external to keep in sync. ───────────────────────────────
create policy "whatsapp_kb_articles_own" on public.whatsapp_kb_articles
  for all using (client_id in (select public.my_assistant_client_ids()))
  with check (client_id in (select public.my_assistant_client_ids()));

create policy "whatsapp_auto_replies_own" on public.whatsapp_auto_replies
  for all using (client_id in (select public.my_assistant_client_ids()))
  with check (client_id in (select public.my_assistant_client_ids()));

-- ── The one necessary exception to "never modify an existing policy" ────
-- Permissive RLS policies combine with OR, so an additive narrower policy
-- cannot shrink what a broader existing one already grants. Left as-is,
-- the public/unauthenticated /aide page's existing read policy would let
-- anyone read every subscribed business's FAQ, not just BizKey's own —
-- dropped and recreated together, in the same transaction, so there's no
-- window where the broader grant is live without the tenant restriction.
drop policy if exists "whatsapp_kb_articles_public_read" on public.whatsapp_kb_articles;
create policy "whatsapp_kb_articles_public_read" on public.whatsapp_kb_articles
  for select using (is_active = true and client_id is null);

-- ── Closes a real cross-tenant leak: the AI reply pipeline resolves
-- kb_article_id with the service-role key (bypasses RLS), so nothing else
-- stops an auto-reply row from pointing at a different tenant's article. ─
create or replace function public.check_auto_reply_kb_article_tenant()
returns trigger language plpgsql as $$
begin
  if new.kb_article_id is not null and not exists (
    select 1 from public.whatsapp_kb_articles a
    where a.id = new.kb_article_id and a.client_id is not distinct from new.client_id
  ) then
    raise exception 'kb_article_id must belong to the same tenant as the auto-reply';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_reply_kb_tenant_check on public.whatsapp_auto_replies;
create trigger trg_auto_reply_kb_tenant_check
before insert or update on public.whatsapp_auto_replies
for each row execute function public.check_auto_reply_kb_article_tenant();
