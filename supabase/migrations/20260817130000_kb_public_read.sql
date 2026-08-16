-- Publishing the same knowledge base that powers BizKey Assistant's
-- auto-replies as a public self-service help page is a common, coherent
-- pattern (Zendesk/Intercom do the same) — one source of truth for both the
-- bot and the public FAQ. Additive policy only; the existing admin `for all`
-- policy is untouched, so a client can never write to this table.
create policy "whatsapp_kb_articles_public_read" on public.whatsapp_kb_articles
  for select using (is_active = true);
