-- Deleting an assistant_clients row (AssistantClients.tsx's admin CRM)
-- failed with a 409 the moment that business had any WhatsApp data at
-- all, because client_id on every whatsapp_* table used the Postgres
-- default ON DELETE NO ACTION when the multi-tenant columns were added —
-- the same class of bug just fixed for profiles deletion.
--
-- The number itself is BizKey's own physical/Evolution-API resource, only
-- assigned to the business — freed (SET NULL) rather than destroyed, so it
-- can be reassigned to the next client. Everything else here only has
-- meaning as this business's own data (their conversations, messages, FAQ,
-- auto-reply rules, customer contacts), so it cascades away with them —
-- a hard "Delete" in the CRM is meant to be permanent. A reversible
-- soft-revoke already exists separately (admin_assign_assistant_plan with
-- a null plan sets status to 'cancelled' without touching any of this).

alter table public.whatsapp_numbers drop constraint whatsapp_numbers_client_id_fkey;
alter table public.whatsapp_numbers add constraint whatsapp_numbers_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete set null;

alter table public.whatsapp_conversations drop constraint whatsapp_conversations_client_id_fkey;
alter table public.whatsapp_conversations add constraint whatsapp_conversations_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.whatsapp_messages drop constraint whatsapp_messages_client_id_fkey;
alter table public.whatsapp_messages add constraint whatsapp_messages_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.whatsapp_kb_articles drop constraint whatsapp_kb_articles_client_id_fkey;
alter table public.whatsapp_kb_articles add constraint whatsapp_kb_articles_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.whatsapp_auto_replies drop constraint whatsapp_auto_replies_client_id_fkey;
alter table public.whatsapp_auto_replies add constraint whatsapp_auto_replies_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.whatsapp_contacts drop constraint whatsapp_contacts_client_id_fkey;
alter table public.whatsapp_contacts add constraint whatsapp_contacts_client_id_fkey
  foreign key (client_id) references public.assistant_clients(id) on delete cascade;
