// WhatsApp Assistant: the document-based knowledge base (uploaded files →
// knowledge_documents, parsed into knowledge_records or, for the
// embeddings-backed pipeline, knowledge_chunks).

import { supabase } from '../lib/supabase'
import type { KnowledgeDocument, KnowledgeRecord, KnowledgeRecordData, KnowledgeChunk } from '../lib/supabase'

export async function getKnowledgeDocuments(clientId: string | null): Promise<KnowledgeDocument[]> {
  let query = supabase.from('knowledge_documents').select('*').order('created_at', { ascending: false })
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeDocument[]
}

export async function getKnowledgeRecords(clientId: string | null): Promise<KnowledgeRecord[]> {
  let query = supabase.from('knowledge_records').select('*').eq('is_active', true)
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeRecord[]
}

/** Uploads the original file to the private knowledge-documents bucket, under {clientId}/{documentId}/{fileName} — that path shape is what the storage RLS policies scope access by. */
export async function uploadKnowledgeDocumentFile(clientId: string, documentId: string, file: File): Promise<string> {
  const path = `${clientId}/${documentId}/${file.name}`
  const { error } = await supabase.storage.from('knowledge-documents').upload(path, file, { upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** Row parsing/mapping happens client-side (see KnowledgeImports UI) — this just persists the already-mapped result. Row count is stamped from the actual insert count, not the caller's claim. */
export async function createKnowledgeDocumentWithRecords(params: {
  clientId: string
  sourceType: 'csv' | 'xlsx'
  title: string
  file: File
  records: KnowledgeRecordData[]
}): Promise<KnowledgeDocument> {
  const documentId = crypto.randomUUID()
  const storagePath = await uploadKnowledgeDocumentFile(params.clientId, documentId, params.file)

  const { data: doc, error: docErr } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      client_id: params.clientId,
      source_type: params.sourceType,
      title: params.title,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      row_count: params.records.length,
      status: 'ready',
    })
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  if (params.records.length > 0) {
    const rows = params.records.map(r => ({
      client_id: params.clientId,
      document_id: documentId,
      record_type: 'product',
      data: r,
      searchable_text: Object.values(r).filter(v => v != null && v !== '').map(String).join(' ').toLowerCase(),
    }))
    const { error: recErr } = await supabase.from('knowledge_records').insert(rows)
    if (recErr) throw new Error(recErr.message)
  }

  return doc as KnowledgeDocument
}

export async function getKnowledgeChunks(clientId: string | null): Promise<KnowledgeChunk[]> {
  let query = supabase.from('knowledge_chunks').select('*')
  query = clientId === null ? query.is('client_id', null) : query.eq('client_id', clientId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeChunk[]
}

/** Same shape as createKnowledgeDocumentWithRecords but for unstructured PDF/DOCX text — chunking already happened client-side (see knowledgeImport.ts), this just persists the result. */
export async function createKnowledgeDocumentWithChunks(params: {
  clientId: string
  sourceType: 'pdf' | 'docx'
  title: string
  file: File
  chunks: string[]
}): Promise<KnowledgeDocument> {
  const documentId = crypto.randomUUID()
  const storagePath = await uploadKnowledgeDocumentFile(params.clientId, documentId, params.file)

  const { data: doc, error: docErr } = await supabase
    .from('knowledge_documents')
    .insert({
      id: documentId,
      client_id: params.clientId,
      source_type: params.sourceType,
      title: params.title,
      storage_path: storagePath,
      file_name: params.file.name,
      mime_type: params.file.type || null,
      file_size_bytes: params.file.size,
      row_count: params.chunks.length,
      status: 'ready',
    })
    .select()
    .single()
  if (docErr) throw new Error(docErr.message)

  if (params.chunks.length > 0) {
    const rows = params.chunks.map((content, index) => ({
      client_id: params.clientId,
      document_id: documentId,
      chunk_index: index,
      content,
    }))
    const { error: chunkErr } = await supabase.from('knowledge_chunks').insert(rows)
    if (chunkErr) throw new Error(chunkErr.message)

    // Best-effort, never blocks the upload: a chunk with no embedding yet
    // just falls back to keyword search (rankKnowledgeChunks) until this
    // catches up, or forever if OPENAI_API_KEY is unset / the call fails.
    embedKnowledgeChunks(documentId).catch(err => console.warn('embedKnowledgeChunks failed:', err))
  }

  return doc as KnowledgeDocument
}

/** Calls the generate-chunk-embeddings edge function — OpenAI call and cost logging happen server-side. Not awaited by its only caller above (fire-and-forget), but exposed so a future "re-embed" retry action could call it directly too. */
export async function embedKnowledgeChunks(documentId: string): Promise<{ embedded: number }> {
  const { data, error } = await supabase.functions.invoke('generate-chunk-embeddings', { body: { documentId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return { embedded: data?.embedded ?? 0 }
}

export async function getKnowledgeRecordsByDocument(documentId: string): Promise<KnowledgeRecord[]> {
  const { data, error } = await supabase.from('knowledge_records').select('*').eq('document_id', documentId).order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeRecord[]
}

export async function getKnowledgeChunksByDocument(documentId: string): Promise<KnowledgeChunk[]> {
  const { data, error } = await supabase.from('knowledge_chunks').select('*').eq('document_id', documentId).order('chunk_index')
  if (error) throw new Error(error.message)
  return (data ?? []) as KnowledgeChunk[]
}

/** Lets an owner/manager drop a single bad row after reviewing an import, without deleting and re-uploading the whole document. Keeps the parent's cached row_count in sync so the document list doesn't drift from what's actually there. */
export async function deleteKnowledgeRecord(record: KnowledgeRecord, currentRowCount: number): Promise<void> {
  const { error } = await supabase.from('knowledge_records').delete().eq('id', record.id)
  if (error) throw new Error(error.message)
  await supabase.from('knowledge_documents').update({ row_count: Math.max(0, currentRowCount - 1) }).eq('id', record.document_id)
}

export async function deleteKnowledgeChunk(chunk: KnowledgeChunk, currentRowCount: number): Promise<void> {
  const { error } = await supabase.from('knowledge_chunks').delete().eq('id', chunk.id)
  if (error) throw new Error(error.message)
  await supabase.from('knowledge_documents').update({ row_count: Math.max(0, currentRowCount - 1) }).eq('id', chunk.document_id)
}

export async function deleteKnowledgeDocument(doc: KnowledgeDocument) {
  // Best-effort — an orphaned storage object with no surviving DB row is a
  // harmless leak, but a delete blocked by a storage error the user can't
  // otherwise resolve is a real dead end, so the DB row (and its cascaded
  // records) always gets removed regardless of storage outcome.
  await supabase.storage.from('knowledge-documents').remove([doc.storage_path]).catch(() => {})
  const { error } = await supabase.from('knowledge_documents').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
}

export interface FaqSuggestion { question: string; answer: string }

/** Calls the generate-faq-from-document edge function — the OpenAI call and its authorization check happen server-side, this just returns suggestions for the caller to review before creating any real whatsapp_kb_articles rows. */
export async function generateFaqFromDocument(documentId: string): Promise<FaqSuggestion[]> {
  const { data, error } = await supabase.functions.invoke('generate-faq-from-document', { body: { documentId } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return (data?.faqs ?? []) as FaqSuggestion[]
}
