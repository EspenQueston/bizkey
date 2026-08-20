import type { WorkBook } from 'xlsx'
import type { KnowledgeRecordData } from './supabase'

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, unknown>[]
}

export interface LoadedWorkbook {
  workbook: WorkBook
  sheetNames: string[]
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

// xlsx/pdfjs-dist/mammoth are only ever needed on this one admin/tenant
// page, and pdfjs-dist's worker alone is 2+ MB — dynamic import() keeps
// all three out of the main app bundle every visitor downloads, loading
// them only when a file is actually selected here.

/**
 * Loading and sheet-parsing are split so the caller can list every sheet
 * (a workbook exported from a real business's spreadsheet often has more
 * than one — "Produits", "Tarifs", "Archive"...) and let the user pick
 * which one to import, instead of silently always taking the first.
 */
export async function loadSpreadsheetWorkbook(file: File): Promise<LoadedWorkbook> {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Fichier trop volumineux (max 20 Mo)')

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  if (workbook.SheetNames.length === 0) throw new Error('Aucune feuille trouvée dans ce fichier')
  return { workbook, sheetNames: workbook.SheetNames }
}

// Deliberately doesn't throw on an empty sheet — a real workbook often has
// a "Résumé"/summary tab with no tabular data at all, and that shouldn't
// dead-end the whole import before the user even sees the sheet picker.
// The caller (handleFileSelect/handleSheetChange) decides what an empty
// result means: skip to the next sheet on initial load, or show an inline
// "this sheet is empty" message if the user picked it manually.
export async function parseWorkbookSheet(workbook: WorkBook, sheetName: string): Promise<ParsedSpreadsheet> {
  const XLSX = await import('xlsx')
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Feuille introuvable dans ce fichier')

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  if (rows.length === 0) return { headers: [], rows: [] }

  const headers = Object.keys(rows[0])
  return { headers, rows }
}

/** A workspace (one knowledge_documents row) can carry at most this many columns — keeps every imported catalog legible in the review table and in the WhatsApp assistant's lookup instead of an unbounded, arbitrarily wide row. */
export const MAX_IMPORT_COLUMNS = 14
/** Rows beyond this per document get split into additional, numbered documents (see splitIntoRowBatches) so a 300-row catalog becomes 3 manageable imports instead of one unwieldy one. */
export const MAX_ROWS_PER_DOCUMENT = 100

/** A file's own headers frequently exceed the 14-column cap, so the first pass keeps a small set of commonly-useful columns pre-checked (name/title, price, category, description-like fields) and leaves the rest for the user to add — never auto-selects past the cap. */
const PRIORITY_SYNONYMS = [
  'nom', 'produit', 'name', 'product', 'article', 'titre', 'désignation', 'title',
  'prix', 'price', 'tarif', 'montant',
  'categorie', 'catégorie', 'category', 'type',
  'description', 'detail', 'détail', 'details', 'détails',
]

/** Best-effort default selection so most files need zero clicks to get a sensible starting point — priority-matching headers first, then whatever's left, capped at MAX_IMPORT_COLUMNS. The user can freely swap any of these before importing. */
export function guessDefaultColumns(headers: string[]): string[] {
  if (headers.length <= MAX_IMPORT_COLUMNS) return [...headers]
  const scored = headers.map(h => ({
    header: h,
    priority: PRIORITY_SYNONYMS.includes(h.trim().toLowerCase()) ? 0 : 1,
  }))
  scored.sort((a, b) => a.priority - b.priority)
  return scored.slice(0, MAX_IMPORT_COLUMNS).map(s => s.header).filter(h => headers.includes(h))
}

function toCellValue(value: unknown): string | number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const s = String(value).trim()
  return s === '' ? null : s
}

/**
 * Builds one flexible record per row using only the columns the user chose
 * to keep, with the source file's own header text as the key — the record
 * mirrors exactly what's in the spreadsheet rather than remapping it into a
 * fixed product schema. A row that ends up fully empty after filtering down
 * to the kept columns (every selected cell blank) is dropped rather than
 * imported as a hollow row.
 */
export function buildRecordsFromColumns(
  rows: Record<string, unknown>[],
  selectedHeaders: string[]
): KnowledgeRecordData[] {
  if (selectedHeaders.length === 0) return []
  return rows
    .map((row): KnowledgeRecordData | null => {
      const record: KnowledgeRecordData = {}
      let hasValue = false
      for (const header of selectedHeaders) {
        const value = toCellValue(row[header])
        record[header] = value
        if (value != null) hasValue = true
      }
      return hasValue ? record : null
    })
    .filter((r): r is KnowledgeRecordData => r !== null)
}

/**
 * Splits a full record set into MAX_ROWS_PER_DOCUMENT-row batches. Each
 * batch becomes its own knowledge_documents row — search/ranking already
 * treats every document's records as one pool (see rankKnowledgeRecords),
 * so splitting only affects how the catalog is organized for browsing/
 * management, never what the WhatsApp assistant can find.
 */
export function splitIntoRowBatches<T>(records: T[], batchSize = MAX_ROWS_PER_DOCUMENT): T[][] {
  if (records.length === 0) return []
  if (records.length <= batchSize) return [records]
  const batches: T[][] = []
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize))
  }
  return batches
}

/**
 * Text-only extraction — getTextContent() never renders the page or
 * executes any embedded script/action, unlike PDF.js's canvas rendering
 * path, so a malicious PDF can't do anything beyond feeding this function
 * plain (if adversarial) strings.
 */
export async function extractPdfText(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Fichier trop volumineux (max 20 Mo)')
  const [pdfjsLib, { default: pdfWorkerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const buffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '))
  }
  const text = pages.join('\n\n').trim()
  if (!text) throw new Error('Aucun texte trouvé dans ce PDF (document scanné/image non pris en charge)')
  return text
}

export async function extractDocxText(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Fichier trop volumineux (max 20 Mo)')
  const { default: mammoth } = await import('mammoth')
  const buffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const text = result.value.trim()
  if (!text) throw new Error('Aucun texte trouvé dans ce document')
  return text
}

const CHUNK_TARGET_CHARS = 800

/**
 * Splits on paragraph breaks first, packing consecutive paragraphs into a
 * chunk until it would exceed the target size — keeps each chunk a
 * coherent, self-contained passage (never mid-sentence) for
 * rankKnowledgeChunks to score and for the WhatsApp reply to quote as-is.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > CHUNK_TARGET_CHARS && current) {
      chunks.push(current)
      current = paragraph
    } else {
      current = candidate
    }
    while (current.length > CHUNK_TARGET_CHARS * 2) {
      chunks.push(current.slice(0, CHUNK_TARGET_CHARS))
      current = current.slice(CHUNK_TARGET_CHARS)
    }
  }
  if (current) chunks.push(current)
  return chunks
}
