-- Knowledge base imports: lets a business upload its existing product/
-- service catalog (Excel/CSV) instead of hand-typing every item as a manual
-- FAQ article. Deliberately scoped to structured spreadsheet data for this
-- first pass — PDF/DOCX (unstructured text) is a separate, larger piece
-- involving text extraction and is not part of this migration.
--
-- No embeddings/pgvector here on purpose: nothing else in this codebase
-- generates embeddings (the actual WhatsApp AI agent runs entirely in n8n,
-- outside this repo — assistant-context/index.ts is just a deterministic
-- lookup tool it calls), and rankKbArticles already proves substring/
-- token-overlap scoring is enough at this catalog size. knowledge_records
-- follows the exact same approach so the two search paths stay consistent.

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  -- null = BizKey's own (matches every other WhatsApp table's convention),
  -- though in practice every real import belongs to a tenant.
  client_id uuid references public.assistant_clients(id),
  source_type text not null check (source_type in ('csv', 'xlsx')),
  title text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  row_count integer not null default 0,
  status text not null default 'ready' check (status in ('ready', 'failed')),
  error text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_documents_client_id on public.knowledge_documents (client_id);

create table public.knowledge_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.assistant_clients(id),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  record_type text not null default 'product',
  -- Flexible per-row payload (name, price, stock, category, description,
  -- image_url) — a jsonb bag rather than fixed columns since which fields a
  -- spreadsheet has varies per business, mirroring whatsapp_kb_articles'
  -- own flexible shape (title/keywords/answer) rather than inventing a
  -- rigid products table.
  data jsonb not null,
  -- Precomputed lowercase concatenation of the fields above, so matching
  -- stays a plain substring/token scan (see rankKnowledgeRecords) instead
  -- of re-deriving searchable text from jsonb on every query.
  searchable_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_knowledge_records_client_id on public.knowledge_records (client_id);
create index idx_knowledge_records_document_id on public.knowledge_records (document_id);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_records enable row level security;

create policy "knowledge_documents_admin" on public.knowledge_documents for all using (public.is_admin());
create policy "knowledge_documents_own_read" on public.knowledge_documents
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "knowledge_documents_own_write" on public.knowledge_documents
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "knowledge_documents_own_update" on public.knowledge_documents
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "knowledge_documents_own_delete" on public.knowledge_documents
  for delete using (client_id in (select public.my_assistant_client_write_ids()));

create policy "knowledge_records_admin" on public.knowledge_records for all using (public.is_admin());
create policy "knowledge_records_own_read" on public.knowledge_records
  for select using (client_id in (select public.my_assistant_client_ids()));
create policy "knowledge_records_own_write" on public.knowledge_records
  for insert with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "knowledge_records_own_update" on public.knowledge_records
  for update using (client_id in (select public.my_assistant_client_write_ids()))
  with check (client_id in (select public.my_assistant_client_write_ids()));
create policy "knowledge_records_own_delete" on public.knowledge_records
  for delete using (client_id in (select public.my_assistant_client_write_ids()));

-- Storage: first bucket this project uses. Private (not public) — a PME's
-- uploaded catalog file is never fetchable by a bare URL, only through a
-- signed URL an authorized caller requests.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-documents', 'knowledge-documents', false, 20971520,
  array[
    'text/csv', 'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Path convention: {client_id}/{document_id}/{file_name} — the first path
-- segment is the tenant, so the same my_assistant_client_ids()/
-- write_ids() functions that scope every other table also scope files.
create policy "knowledge_documents_storage_read" on storage.objects
  for select using (
    bucket_id = 'knowledge-documents' and (
      public.is_admin() or
      (storage.foldername(name))[1] in (select public.my_assistant_client_ids()::text)
    )
  );

create policy "knowledge_documents_storage_write" on storage.objects
  for insert with check (
    bucket_id = 'knowledge-documents' and (
      public.is_admin() or
      (storage.foldername(name))[1] in (select public.my_assistant_client_write_ids()::text)
    )
  );

create policy "knowledge_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'knowledge-documents' and (
      public.is_admin() or
      (storage.foldername(name))[1] in (select public.my_assistant_client_write_ids()::text)
    )
  );
