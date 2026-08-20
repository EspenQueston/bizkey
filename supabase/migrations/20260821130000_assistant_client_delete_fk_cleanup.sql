-- Deleting an assistant_clients row (the admin's "Supprimer ce catalogue" /
-- AssistantClients delete button) was broken for virtually any real,
-- actively-used business: handoff_tickets, knowledge_chunks,
-- knowledge_documents, knowledge_records, and usage_events all referenced
-- client_id with the Postgres default NO ACTION, so the delete failed with
-- a raw FK-violation error the moment a business had a single handoff
-- ticket, a single imported document, or a single usage_events row logged
-- against it. The admin UI's own delete-confirmation copy already promises
-- "conversations, base de connaissances et règles associées" get removed —
-- this migration is what actually makes that true for the tables that
-- weren't already wired up (whatsapp_* already cascade correctly).
--
-- usage_events is the one exception: it's a cost/billing audit log of real
-- money already spent, not disposable content the business owns — deleting
-- the business detaches it (set null, same convention as the existing
-- "null = BizKey's own bucket" used elsewhere) rather than erasing the
-- historical spend record.

alter table public.handoff_tickets
  drop constraint handoff_tickets_client_id_fkey,
  add constraint handoff_tickets_client_id_fkey
    foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.knowledge_chunks
  drop constraint knowledge_chunks_client_id_fkey,
  add constraint knowledge_chunks_client_id_fkey
    foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.knowledge_documents
  drop constraint knowledge_documents_client_id_fkey,
  add constraint knowledge_documents_client_id_fkey
    foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.knowledge_records
  drop constraint knowledge_records_client_id_fkey,
  add constraint knowledge_records_client_id_fkey
    foreign key (client_id) references public.assistant_clients(id) on delete cascade;

alter table public.usage_events
  drop constraint usage_events_client_id_fkey,
  add constraint usage_events_client_id_fkey
    foreign key (client_id) references public.assistant_clients(id) on delete set null;
