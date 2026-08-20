-- Same class of bug as 20260821130000 (assistant client deletion), found by
-- auditing every other NO ACTION foreign key in the schema for one that a
-- real, exposed "Supprimer" button could actually hit:
--
--   - deleteWhatsAppKbArticle (WhatsAppKnowledgeBase.tsx) failed if that
--     article was ever picked as an auto-reply rule's response source.
--   - deleteWhatsAppNumber (WhatsAppNumbers.tsx) failed if the number was
--     connected to a business, or had any conversation history at all —
--     i.e. any number that was ever actually used.
--   - Deleting a staff/customer profile that had resolved or been assigned
--     a handoff ticket, or uploaded a knowledge document, would fail (these
--     tables were added after 20260817230000_profile_deletion_cascade.sql
--     and never got the same treatment).
--   - Removing a team member row for an inactive invite would fail if the
--     inviting admin's own profile no longer existed.
--
-- Every column here is nullable and is an attribution/soft-link, not
-- ownership — the referencing row (the KB rule, the conversation, the
-- ticket, the document, the membership) is real, valuable data that should
-- survive with the link detached, not be destroyed just because the thing
-- it pointed at is gone. This mirrors 20260817230000's own SET NULL cases
-- exactly (system_events.user_id, quote_requests.quoted_by,
-- whatsapp_conversations.assigned_to, assistant_clients.profile_id) rather
-- than inventing a new convention.
--
-- erp_orders.client_id (→ erp_clients) is deliberately left as-is: real
-- order/shipment history should keep blocking client deletion, same
-- reasoning as erp_orders.user_id/erp_clients.user_id/erp_deliveries.user_id
-- in the prior migration.

alter table public.whatsapp_auto_replies
  drop constraint whatsapp_auto_replies_kb_article_id_fkey,
  add constraint whatsapp_auto_replies_kb_article_id_fkey
    foreign key (kb_article_id) references public.whatsapp_kb_articles(id) on delete set null;

alter table public.assistant_clients
  drop constraint assistant_clients_whatsapp_number_id_fkey,
  add constraint assistant_clients_whatsapp_number_id_fkey
    foreign key (whatsapp_number_id) references public.whatsapp_numbers(id) on delete set null;

alter table public.whatsapp_conversations
  drop constraint whatsapp_conversations_number_id_fkey,
  add constraint whatsapp_conversations_number_id_fkey
    foreign key (number_id) references public.whatsapp_numbers(id) on delete set null;

alter table public.whatsapp_conversations
  drop constraint whatsapp_conversations_contact_id_fkey,
  add constraint whatsapp_conversations_contact_id_fkey
    foreign key (contact_id) references public.whatsapp_contacts(id) on delete set null;

alter table public.handoff_tickets
  drop constraint handoff_tickets_resolved_by_fkey,
  add constraint handoff_tickets_resolved_by_fkey
    foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.handoff_tickets
  drop constraint handoff_tickets_assigned_to_fkey,
  add constraint handoff_tickets_assigned_to_fkey
    foreign key (assigned_to) references public.profiles(id) on delete set null;

alter table public.knowledge_documents
  drop constraint knowledge_documents_uploaded_by_fkey,
  add constraint knowledge_documents_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles(id) on delete set null;

alter table public.assistant_client_members
  drop constraint assistant_client_members_invited_by_fkey,
  add constraint assistant_client_members_invited_by_fkey
    foreign key (invited_by) references public.profiles(id) on delete set null;
