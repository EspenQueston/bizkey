import type { KnowledgeRecordData } from './supabase'

export interface ParsedSpreadsheet {
  headers: string[]
  rows: Record<string, unknown>[]
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

// xlsx/pdfjs-dist/mammoth are only ever needed on this one admin/tenant
// page, and pdfjs-dist's worker alone is 2+ MB — dynamic import() keeps
// all three out of the main app bundle every visitor downloads, loading
// them only when a file is actually selected here.
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Fichier trop volumineux (max 20 Mo)')

  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('Aucune feuille trouvée dans ce fichier')
  const sheet = workbook.Sheets[firstSheetName]

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
  if (rows.length === 0) throw new Error('Ce fichier ne contient aucune ligne de données')

  const headers = Object.keys(rows[0])
  return { headers, rows }
}

export type MappableField = keyof KnowledgeRecordData
export const MAPPABLE_FIELDS: { key: MappableField; label: string; required: boolean }[] = [
  { key: 'name', label: 'Nom du produit/service', required: true },
  { key: 'price', label: 'Prix', required: false },
  { key: 'stock', label: 'Stock', required: false },
  { key: 'category', label: 'Catégorie', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'image_url', label: 'URL image', required: false },
]

const FIELD_SYNONYMS: Record<MappableField, string[]> = {
  name: ['nom', 'produit', 'name', 'product', 'article', 'titre', 'désignation'],
  price: ['prix', 'price', 'tarif', 'montant', 'cout', 'coût'],
  stock: ['stock', 'quantite', 'quantité', 'qty', 'disponibilite', 'disponibilité'],
  category: ['categorie', 'catégorie', 'category', 'type', 'famille'],
  description: ['description', 'detail', 'détail', 'details', 'détails', 'notes'],
  image_url: ['image', 'image url', 'photo', 'image_url', 'lien image', 'picture'],
}

/** Best-effort auto-mapping by matching header names against common French/English synonyms — the user can always override before importing. */
export function guessColumnMapping(headers: string[]): Partial<Record<MappableField, string>> {
  const mapping: Partial<Record<MappableField, string>> = {}
  for (const field of MAPPABLE_FIELDS) {
    const synonyms = FIELD_SYNONYMS[field.key]
    const match = headers.find(h => synonyms.includes(h.trim().toLowerCase()))
    if (match) mapping[field.key] = match
  }
  return mapping
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
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

export function buildRecordsFromMapping(
  rows: Record<string, unknown>[],
  mapping: Partial<Record<MappableField, string>>
): KnowledgeRecordData[] {
  const nameColumn = mapping.name
  if (!nameColumn) return []

  return rows
    .map((row): KnowledgeRecordData | null => {
      const name = toStringOrNull(row[nameColumn])
      if (!name) return null
      return {
        name,
        price: mapping.price ? toNumberOrNull(row[mapping.price]) : null,
        stock: mapping.stock ? toNumberOrNull(row[mapping.stock]) : null,
        category: mapping.category ? toStringOrNull(row[mapping.category]) : null,
        description: mapping.description ? toStringOrNull(row[mapping.description]) : null,
        image_url: mapping.image_url ? toStringOrNull(row[mapping.image_url]) : null,
      }
    })
    .filter((r): r is KnowledgeRecordData => r !== null)
}
