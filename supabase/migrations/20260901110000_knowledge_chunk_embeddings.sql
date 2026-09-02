-- Adds real vector-embedding search on top of knowledge_chunks (PDF/DOCX
-- text passages) — until now the only ranking was rankKnowledgeChunks'
-- substring/token-overlap scoring, which misses a paraphrase that shares no
-- words with the source text ("vous livrez où" vs a document that only says
-- "zones de livraison couvertes"). Purely additive: the embedding column is
-- nullable, existing keyword search keeps working unchanged for any chunk
-- that has no embedding yet (a fresh row before the async embedding call
-- lands, or a permanent fallback if OPENAI_API_KEY is ever unset).

create extension if not exists vector;

alter table public.knowledge_chunks add column embedding vector(1536);

-- hnsw over ivfflat: no list-count tuning needed and pgvector 0.8 supports
-- it. NULL embeddings are simply left out of the index, matching rows just
-- never surface from match_knowledge_chunks below until they're embedded.
create index idx_knowledge_chunks_embedding on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Cosine-similarity search, scoped by client_id explicitly (not just RLS) —
-- this is called from both an authenticated browser session (where RLS
-- alone would suffice) and the assistant-context edge function running as
-- the service role (which bypasses RLS entirely and needs the real filter).
-- SECURITY INVOKER (the default) so a browser caller still can't see past
-- their own RLS grant even if they somehow passed another tenant's id.
create or replace function public.match_knowledge_chunks(
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 5
)
returns table (id uuid, document_id uuid, content text, similarity float)
language sql stable as $$
  select kc.id, kc.document_id, kc.content, 1 - (kc.embedding <=> p_query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and (kc.client_id is not distinct from p_client_id)
  order by kc.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1)
$$;

-- Same widen-the-check-constraint pattern as 20260821100000_faq_generation_usage.sql
-- — get_usage_summary already sums across every event_type with no frontend
-- change needed, so embedding cost just shows up in the existing "Coût IA"
-- totals for free.
alter table public.usage_events
  drop constraint usage_events_event_type_check,
  add constraint usage_events_event_type_check
    check (event_type in ('message_inbound', 'message_outbound', 'faq_generation', 'embedding_generation'));
