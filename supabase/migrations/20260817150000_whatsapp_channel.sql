-- Foundation for website <-> WhatsApp sync: a conversation/message may
-- originate from either channel while staying one unified thread (already
-- possible via whatsapp_contacts.customer_profile_id). This just tags which
-- channel each row came from so the UI can label it; it does not add the
-- website chat surface itself, which needs a corresponding n8n trigger
-- before it can round-trip through the same AI Agent.

alter table public.whatsapp_conversations
  add column if not exists channel text not null default 'whatsapp' check (channel in ('whatsapp', 'website'));

alter table public.whatsapp_messages
  add column if not exists channel text not null default 'whatsapp' check (channel in ('whatsapp', 'website'));
