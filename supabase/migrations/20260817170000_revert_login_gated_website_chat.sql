-- Reverts an earlier, abandoned attempt at website chat (login-required,
-- trial-credit-gated) that was applied locally but never committed. The
-- direction is now the opposite: BizKey WhatsApp Assistant is open to
-- everyone on the website, connected or not — same as WhatsApp itself never
-- requiring a BizKey account. That version is handled entirely by the
-- whatsapp-website-chat edge function using an anonymous visitor id stored
-- as whatsapp_contacts.whatsapp_number ('web:<uuid>'), reusing the same
-- contact/conversation model as the WhatsApp channel — no separate
-- profile-linked, auth-gated path needed.

drop policy if exists "whatsapp_conversations_own_website" on public.whatsapp_conversations;
drop policy if exists "whatsapp_messages_own_website" on public.whatsapp_messages;
drop function if exists public.consume_whatsapp_trial_message(uuid);

alter table public.whatsapp_conversations
  drop column if exists customer_profile_id;

-- Safe to restore: the current website-chat flow always sets customer_phone
-- (to 'web:<uuid>' for anonymous visitors), same as the WhatsApp channel.
update public.whatsapp_conversations set customer_phone = '' where customer_phone is null;
alter table public.whatsapp_conversations
  alter column customer_phone set not null;

alter table public.profiles
  drop column if exists whatsapp_trial_remaining;
