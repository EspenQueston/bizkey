-- Second half of the knowledge-import brief: PDF/DOCX documents. Unlike a
-- spreadsheet, a PDF/DOCX has no rows/columns — it's extracted into plain
-- text and split into passages (chunks), which is what actually gets
-- searched. Same no-embeddings stance as knowledge_records
-- (20260820100000): rankKnowledgeChunks uses the same deterministic
-- substring/token-overlap scoring as everything else in this pipeline.

alter table public.knowledge_documents
  drop constraint knowledge_documents_source_type_check,
  add constraint knowledge_documents_source_type_check check (source_type in ('csv', 'xlsx', 'pdf', 'docx'));

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.assistant_clients(id),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_knowledge_chunks_client_id on public.knowledge_chunks (client_id);
create index idx_knowledge_chunks_document_id on public.knowledge_chunks (document_id);

alter table public.knowledge_chunks enable row level security;

create policy "knowledge_chunks_admin" on public.knowledge_chunks for all using (public.is_admin());
create policy "knowledge_chunks_own_read" on public.knowledge_chunks
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "knowledge_chunks_own_write" on public.knowledge_chunks
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "knowledge_chunks_own_delete" on public.knowledge_chunks
  for delete using (client_id in (select public.my_assistant_client_write_ids()));

-- Widen the bucket to accept PDF/DOCX alongside the spreadsheet types it
-- already allows.
update storage.buckets
set allowed_mime_types = array[
  'text/csv', 'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'knowledge-documents';
