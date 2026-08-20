import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Save, BookOpen, Trash2, Edit2, Search, Upload, FileSpreadsheet, FileText, Check, Loader2, PackageSearch, Eye, Layers, Sparkles, Columns3, SplitSquareHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import {
  getWhatsAppKbArticles, createWhatsAppKbArticle, updateWhatsAppKbArticle, deleteWhatsAppKbArticle,
  getKnowledgeDocuments, createKnowledgeDocumentWithRecords, createKnowledgeDocumentWithChunks, deleteKnowledgeDocument,
  getKnowledgeRecordsByDocument, getKnowledgeChunksByDocument, deleteKnowledgeRecord, deleteKnowledgeChunk,
  generateFaqFromDocument, type FaqSuggestion,
} from '@/lib/db'
import {
  loadSpreadsheetWorkbook, parseWorkbookSheet, guessDefaultColumns, buildRecordsFromColumns, splitIntoRowBatches,
  extractPdfText, extractDocxText, chunkText, MAX_IMPORT_COLUMNS, MAX_ROWS_PER_DOCUMENT,
} from '@/lib/knowledgeImport'
import { useAuth } from '@/contexts/AuthContext'
import type { WhatsAppKbArticle, KnowledgeDocument, KnowledgeRecord, KnowledgeChunk } from '@/lib/supabase'
import type { WorkBook } from 'xlsx'
import { toast } from 'sonner'

const EMPTY = { title: '', keywords: '', answer: '', is_active: true }

export default function WhatsAppKnowledgeBasePage() {
  const { profile, assistantClient, assistantRole } = useAuth()
  const isAdmin = profile?.is_admin === true
  const canWriteCatalog = assistantRole === 'owner' || assistantRole === 'manager'
  const [articles, setArticles] = useState<WhatsAppKbArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WhatsAppKbArticle | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Catalog import (Excel/CSV/PDF/DOCX) state
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingKind, setPendingKind] = useState<'spreadsheet' | 'document' | null>(null)
  const [pendingWorkbook, setPendingWorkbook] = useState<WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [switchingSheet, setSwitchingSheet] = useState(false)
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([])
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [pendingChunks, setPendingChunks] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<KnowledgeDocument | null>(null)

  // Document detail view (browse/remove individual imported rows/passages)
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDocument | null>(null)
  const [viewRecords, setViewRecords] = useState<KnowledgeRecord[]>([])
  const [viewChunks, setViewChunks] = useState<KnowledgeChunk[]>([])
  const [loadingView, setLoadingView] = useState(false)
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
  // Different imports can keep different columns, so the detail table's
  // headers are derived from whatever keys are actually present across this
  // document's rows rather than a fixed product schema.
  const viewColumns = useMemo(
    () => Array.from(new Set(viewRecords.flatMap(r => Object.keys(r.data)))),
    [viewRecords]
  )

  const isSpreadsheetDoc = (doc: KnowledgeDocument) => doc.source_type === 'csv' || doc.source_type === 'xlsx'

  function openDocView(doc: KnowledgeDocument) {
    setViewingDoc(doc)
    setLoadingView(true)
    const load = isSpreadsheetDoc(doc)
      ? getKnowledgeRecordsByDocument(doc.id).then(setViewRecords)
      : getKnowledgeChunksByDocument(doc.id).then(setViewChunks)
    load.catch(err => toast.error(err instanceof Error ? err.message : 'Échec du chargement')).finally(() => setLoadingView(false))
  }

  function closeDocView() {
    setViewingDoc(null)
    setViewRecords([])
    setViewChunks([])
  }

  async function handleDeleteRecord(record: KnowledgeRecord) {
    if (!viewingDoc) return
    setDeletingRowId(record.id)
    try {
      await deleteKnowledgeRecord(record, viewingDoc.row_count)
      setViewRecords(prev => prev.filter(r => r.id !== record.id))
      setDocuments(prev => prev.map(d => d.id === viewingDoc.id ? { ...d, row_count: Math.max(0, d.row_count - 1) } : d))
      setViewingDoc(prev => prev ? { ...prev, row_count: Math.max(0, prev.row_count - 1) } : prev)
      toast.success('Ligne supprimée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la suppression')
    } finally {
      setDeletingRowId(null)
    }
  }

  async function handleDeleteChunk(chunk: KnowledgeChunk) {
    if (!viewingDoc) return
    setDeletingRowId(chunk.id)
    try {
      await deleteKnowledgeChunk(chunk, viewingDoc.row_count)
      setViewChunks(prev => prev.filter(c => c.id !== chunk.id))
      setDocuments(prev => prev.map(d => d.id === viewingDoc.id ? { ...d, row_count: Math.max(0, d.row_count - 1) } : d))
      setViewingDoc(prev => prev ? { ...prev, row_count: Math.max(0, prev.row_count - 1) } : prev)
      toast.success('Passage supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la suppression')
    } finally {
      setDeletingRowId(null)
    }
  }

  function loadDocuments() {
    if (!assistantClient) { setLoadingDocs(false); return }
    setLoadingDocs(true)
    getKnowledgeDocuments(assistantClient.id).then(setDocuments).catch(console.error).finally(() => setLoadingDocs(false))
  }

  useEffect(loadDocuments, [assistantClient])

  // AI-generated FAQ suggestions (from an existing imported document) —
  // review-before-commit, same spirit as the CSV column-mapping preview:
  // the model's output is never written to whatsapp_kb_articles directly.
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)
  const [faqSuggestions, setFaqSuggestions] = useState<FaqSuggestion[]>([])
  const [faqSelected, setFaqSelected] = useState<Set<number>>(new Set())
  const [faqSourceDoc, setFaqSourceDoc] = useState<KnowledgeDocument | null>(null)
  const [savingFaqSuggestions, setSavingFaqSuggestions] = useState(false)

  async function handleGenerateFaq(doc: KnowledgeDocument) {
    setGeneratingDocId(doc.id)
    try {
      const suggestions = await generateFaqFromDocument(doc.id)
      setFaqSuggestions(suggestions)
      setFaqSelected(new Set(suggestions.map((_, i) => i)))
      setFaqSourceDoc(doc)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la génération')
    } finally {
      setGeneratingDocId(null)
    }
  }

  function closeFaqSuggestions() {
    setFaqSuggestions([])
    setFaqSelected(new Set())
    setFaqSourceDoc(null)
  }

  function toggleFaqSelected(index: number) {
    setFaqSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleAddSelectedFaqs() {
    if (!assistantClient || faqSelected.size === 0) return
    setSavingFaqSuggestions(true)
    try {
      const toAdd = faqSuggestions.filter((_, i) => faqSelected.has(i))
      const created = await Promise.all(toAdd.map(f =>
        createWhatsAppKbArticle({ title: f.question, keywords: [], answer: f.answer, is_active: true, client_id: assistantClient.id })
      ))
      setArticles(prev => [...created, ...prev])
      toast.success(`${created.length} question${created.length > 1 ? 's' : ''} ajoutée${created.length > 1 ? 's' : ''} à la FAQ`)
      closeFaqSuggestions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'ajout")
    } finally {
      setSavingFaqSuggestions(false)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setParseError('')
    setParsing(true)
    try {
      if (/\.(csv|xlsx?|xls)$/i.test(file.name)) {
        const { workbook, sheetNames: names } = await loadSpreadsheetWorkbook(file)
        // Default to the first sheet that actually has data — a "Résumé"/
        // summary tab with no table shouldn't block the import or hide the
        // sheet picker; it just isn't a sensible initial pick.
        let chosen = names[0]
        let parsed = await parseWorkbookSheet(workbook, chosen)
        for (const name of names) {
          if (parsed.rows.length > 0) break
          parsed = await parseWorkbookSheet(workbook, name)
          chosen = name
        }
        setPendingFile(file)
        setPendingKind('spreadsheet')
        setPendingWorkbook(workbook)
        setSheetNames(names)
        setSelectedSheet(chosen)
        setParsedHeaders(parsed.headers)
        setParsedRows(parsed.rows)
        setSelectedColumns(new Set(guessDefaultColumns(parsed.headers)))
        if (parsed.rows.length === 0) {
          setParseError(names.length > 1 ? "Aucune des feuilles de ce fichier ne contient de données — vérifiez qu'elles ont bien une ligne d'en-têtes." : 'Ce fichier ne contient aucune ligne de données.')
        }
      } else if (/\.pdf$/i.test(file.name)) {
        const text = await extractPdfText(file)
        setPendingFile(file)
        setPendingKind('document')
        setPendingChunks(chunkText(text))
      } else if (/\.docx$/i.test(file.name)) {
        const text = await extractDocxText(file)
        setPendingFile(file)
        setPendingKind('document')
        setPendingChunks(chunkText(text))
      } else {
        throw new Error('Format non pris en charge — utilisez .csv, .xlsx, .pdf ou .docx')
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Impossible de lire ce fichier')
      setPendingFile(null)
      setPendingKind(null)
    } finally {
      setParsing(false)
    }
  }

  function cancelImport() {
    setPendingFile(null)
    setPendingKind(null)
    setPendingWorkbook(null)
    setSheetNames([])
    setSelectedSheet('')
    setParsedHeaders([])
    setParsedRows([])
    setSelectedColumns(new Set())
    setPendingChunks([])
    setParseError('')
  }

  /** Re-parses the same workbook against a different sheet the user picks — a real business export often has more than one ("Produits", "Tarifs", "Archive"), and the first sheet isn't always the one they meant to import. */
  async function handleSheetChange(sheetName: string) {
    if (!pendingWorkbook || sheetName === selectedSheet) return
    setSwitchingSheet(true)
    setParseError('')
    try {
      const { headers, rows } = await parseWorkbookSheet(pendingWorkbook, sheetName)
      setSelectedSheet(sheetName)
      setParsedHeaders(headers)
      setParsedRows(rows)
      setSelectedColumns(new Set(guessDefaultColumns(headers)))
      setParseError(rows.length === 0 ? 'Cette feuille ne contient aucune ligne de données — essayez-en une autre.' : '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impossible de lire cette feuille')
    } finally {
      setSwitchingSheet(false)
    }
  }

  const selectedHeaderList = useMemo(
    () => parsedHeaders.filter(h => selectedColumns.has(h)),
    [parsedHeaders, selectedColumns]
  )
  const builtRecords = useMemo(
    () => pendingKind === 'spreadsheet' ? buildRecordsFromColumns(parsedRows, selectedHeaderList) : [],
    [pendingKind, parsedRows, selectedHeaderList]
  )
  const rowBatches = useMemo(() => splitIntoRowBatches(builtRecords), [builtRecords])
  const willSplit = rowBatches.length > 1

  function toggleColumn(header: string) {
    setSelectedColumns(prev => {
      const next = new Set(prev)
      if (next.has(header)) {
        next.delete(header)
        return next
      }
      if (next.size >= MAX_IMPORT_COLUMNS) {
        toast.error(`Vous pouvez garder au maximum ${MAX_IMPORT_COLUMNS} colonnes par import`)
        return prev
      }
      next.add(header)
      return next
    })
  }

  async function handleImport() {
    if (!assistantClient || !pendingFile) return
    setImporting(true)
    // Tracked outside the try body so a failure partway through a multi-part
    // split (batch 2 of 3 fails, say) can still report exactly how many
    // parts made it in — each one is already a real, independent row in the
    // database by the time it's pushed here, so the catch block below must
    // never let it go unreported just because a later part failed.
    const createdDocs: KnowledgeDocument[] = []
    try {
      const baseTitle = pendingFile.name.replace(/\.(csv|xlsx?|xls|pdf|docx)$/i, '')
      const title = pendingKind === 'spreadsheet' && sheetNames.length > 1 ? `${baseTitle} — ${selectedSheet}` : baseTitle
      if (pendingKind === 'spreadsheet') {
        if (rowBatches.length === 0) return
        const sourceType = /\.csv$/i.test(pendingFile.name) ? 'csv' : 'xlsx'
        for (let i = 0; i < rowBatches.length; i++) {
          const partTitle = rowBatches.length > 1 ? `${title} (partie ${i + 1}/${rowBatches.length})` : title
          const doc = await createKnowledgeDocumentWithRecords({ clientId: assistantClient.id, sourceType, title: partTitle, file: pendingFile, records: rowBatches[i] })
          createdDocs.push(doc)
          setDocuments(prev => [doc, ...prev])
        }
      } else {
        if (pendingChunks.length === 0) return
        const sourceType = /\.pdf$/i.test(pendingFile.name) ? 'pdf' : 'docx'
        const doc = await createKnowledgeDocumentWithChunks({ clientId: assistantClient.id, sourceType, title, file: pendingFile, chunks: pendingChunks })
        createdDocs.push(doc)
        setDocuments(prev => [doc, ...prev])
      }
      cancelImport()
      const totalRows = createdDocs.reduce((sum, d) => sum + d.row_count, 0)
      const unit = pendingKind === 'spreadsheet' ? 'ligne' : 'passage'
      toast.success(
        createdDocs.length > 1
          ? `${totalRows} ${unit}s importées en ${createdDocs.length} fichiers`
          : `${totalRows} ${unit}${totalRows > 1 ? 's' : ''} importé${totalRows > 1 ? 's' : ''}`
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Échec de l'import"
      toast.error(
        createdDocs.length > 0
          ? `${createdDocs.length} partie${createdDocs.length > 1 ? 's' : ''} importée${createdDocs.length > 1 ? 's' : ''} avant l'échec — ${reason}`
          : reason
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDeleteDocument(doc: KnowledgeDocument) {
    setDeletingDocId(doc.id)
    try {
      await deleteKnowledgeDocument(doc)
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Catalogue supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la suppression')
    } finally {
      setDeletingDocId(null)
      setConfirmDeleteDoc(null)
    }
  }

  useEffect(() => {
    // The public BizKey FAQ (client_id null) also matches the reader's own
    // `_own` policy scope incidentally via the separate public-read policy —
    // filter it back out here so a business owner only manages their own rows.
    getWhatsAppKbArticles()
      .then(all => setArticles(isAdmin ? all : all.filter(a => a.client_id === assistantClient?.id)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [isAdmin, assistantClient?.id])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowModal(true)
  }

  function openEdit(a: WhatsAppKbArticle) {
    setEditing(a)
    setForm({ title: a.title, keywords: a.keywords.join(', '), answer: a.answer, is_active: a.is_active })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.answer.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
        answer: form.answer.trim(),
        is_active: form.is_active,
      }
      if (editing) {
        const updated = await updateWhatsAppKbArticle(editing.id, payload)
        setArticles(prev => prev.map(a => a.id === editing.id ? updated : a))
      } else {
        const created = await createWhatsAppKbArticle({ ...payload, client_id: isAdmin ? null : assistantClient?.id ?? null })
        setArticles(prev => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteWhatsAppKbArticle(id)
      setArticles(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">📚 Base de connaissances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{articles.length} article{articles.length !== 1 ? 's' : ''} · {articles.filter(a => a.is_active).length} actif{articles.filter(a => a.is_active).length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouvel article
        </Button>
      </div>

      {assistantClient && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PackageSearch className="h-3.5 w-3.5" /> Documents importés (Excel, CSV, PDF, Word)
              </p>
              {canWriteCatalog && !pendingFile && (
                <label className="inline-flex">
                  <input type="file" accept=".csv,.xlsx,.xls,.pdf,.docx" className="hidden" onChange={handleFileSelect} disabled={parsing} />
                  <Button size="sm" variant="outline" className="rounded-full gap-1.5 cursor-pointer" disabled={parsing} asChild>
                    <span>{parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Importer un fichier</span>
                  </Button>
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Importez votre catalogue produits (Excel/CSV) ou vos documents (PDF/Word — menu, tarifs, conditions...) — l'assistant WhatsApp pourra répondre directement à partir de ces données.
            </p>

            {parseError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{parseError}</div>
            )}

            {pendingFile && pendingKind === 'spreadsheet' && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                    <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">{pendingFile.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{parsedRows.length} ligne{parsedRows.length > 1 ? 's' : ''} détectée{parsedRows.length > 1 ? 's' : ''}</Badge>
                  </div>
                  <button onClick={cancelImport} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
                </div>

                {sheetNames.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5"><Layers className="h-3 w-3" /> Feuille à importer</Label>
                    <select
                      value={selectedSheet}
                      onChange={e => handleSheetChange(e.target.value)}
                      disabled={switchingSheet}
                      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-60"
                    >
                      {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">Ce fichier contient {sheetNames.length} feuilles — choisissez celle à importer.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs flex items-center gap-1.5"><Columns3 className="h-3 w-3" /> Colonnes à conserver</Label>
                    <Badge variant={selectedColumns.size >= MAX_IMPORT_COLUMNS ? 'default' : 'outline'} className="text-[10px] shrink-0">
                      {selectedColumns.size} / {MAX_IMPORT_COLUMNS}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Choisissez les colonnes de « {selectedSheet || pendingFile.name} » à garder dans la base de connaissances — {MAX_IMPORT_COLUMNS} maximum, le reste est ignoré.
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
                    {parsedHeaders.map(header => {
                      const active = selectedColumns.has(header)
                      return (
                        <button
                          key={header}
                          type="button"
                          onClick={() => toggleColumn(header)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-muted-foreground border-input hover:border-primary/40 hover:text-foreground'
                          }`}
                        >
                          {active && <Check className="h-3 w-3" />}
                          {header}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {willSplit && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
                    <SplitSquareHorizontal className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {builtRecords.length} lignes dépassent la limite de {MAX_ROWS_PER_DOCUMENT} par import — elles seront automatiquement réparties en {rowBatches.length} fichiers ({rowBatches.map(b => b.length).join(', ')} lignes).
                    </span>
                  </div>
                )}

                {selectedColumns.size === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Sélectionnez au moins une colonne pour prévisualiser les données.</p>
                ) : builtRecords.length > 0 && (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/50">
                        <tr>
                          {selectedHeaderList.map(h => (
                            <th key={h} className="text-left px-2.5 py-1.5 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {builtRecords.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            {selectedHeaderList.map(h => (
                              <td key={h} className="px-2.5 py-1.5 whitespace-nowrap">{r[h] ?? '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {builtRecords.length > 3 && (
                      <p className="text-[11px] text-muted-foreground px-2.5 py-1.5">+ {builtRecords.length - 3} autre{builtRecords.length - 3 > 1 ? 's' : ''} ligne{builtRecords.length - 3 > 1 ? 's' : ''}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-lg" onClick={cancelImport}>Annuler</Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg gap-1.5"
                    onClick={handleImport}
                    disabled={importing || selectedColumns.size === 0 || builtRecords.length === 0}
                  >
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {willSplit
                      ? `Importer ${builtRecords.length} lignes (${rowBatches.length} fichiers)`
                      : `Importer ${builtRecords.length} ligne${builtRecords.length > 1 ? 's' : ''}`}
                  </Button>
                </div>
              </div>
            )}

            {pendingFile && pendingKind === 'document' && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4 text-primary" /> {pendingFile.name}
                    <Badge variant="outline" className="text-[10px]">{pendingChunks.length} passage{pendingChunks.length > 1 ? 's' : ''} extrait{pendingChunks.length > 1 ? 's' : ''}</Badge>
                  </div>
                  <button onClick={cancelImport} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>

                {pendingChunks.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {pendingChunks[0]}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="rounded-lg" onClick={cancelImport}>Annuler</Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-lg gap-1.5"
                    onClick={handleImport}
                    disabled={importing || pendingChunks.length === 0}
                  >
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Importer {pendingChunks.length} passage{pendingChunks.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}

            {loadingDocs ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
              </div>
            ) : documents.length > 0 && (
              <div className="space-y-1.5">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
                    {doc.source_type === 'csv' || doc.source_type === 'xlsx'
                      ? <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.row_count} {doc.source_type === 'csv' || doc.source_type === 'xlsx' ? 'article' : 'passage'}{doc.row_count > 1 ? 's' : ''} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 rounded-lg shrink-0"
                      onClick={() => openDocView(doc)}
                      title="Voir le détail"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canWriteCatalog && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 px-2 rounded-lg gap-1 text-primary hover:text-primary shrink-0"
                        onClick={() => handleGenerateFaq(doc)}
                        disabled={generatingDocId === doc.id}
                        title="Générer une FAQ avec l'IA à partir de ce document"
                      >
                        {generatingDocId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        <span className="text-[11px] hidden sm:inline">FAQ IA</span>
                      </Button>
                    )}
                    {canWriteCatalog && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 rounded-lg hover:text-destructive shrink-0"
                        onClick={() => setConfirmDeleteDoc(doc)}
                        disabled={deletingDocId === doc.id}
                      >
                        {deletingDocId === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un article ou mot-clé..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{articles.length === 0 ? 'Aucun article' : 'Aucun résultat'}</p>
          {articles.length === 0 && <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />Créer un article</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{a.title}</p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${a.is_active ? 'text-primary border-primary/30' : 'text-muted-foreground'}`}>
                    {a.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{a.answer}</p>
                <div className="flex flex-wrap gap-1">
                  {a.keywords.map(k => (
                    <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{k}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg gap-1" onClick={() => openEdit(a)}>
                    <Edit2 className="h-3 w-3" /> Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-lg gap-1 hover:text-destructive"
                    onClick={() => setConfirmDeleteId(a.id)}
                    disabled={deletingId === a.id}
                  >
                    {deletingId === a.id ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Trash2 className="h-3 w-3" />}
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">{editing ? "Modifier l'article" : 'Nouvel article'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input placeholder="Ex: Délais de livraison" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Mots-clés (séparés par des virgules)</Label>
                <Input placeholder="livraison, délai, combien de temps" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Réponse *</Label>
                <textarea
                  rows={5}
                  placeholder="La réponse envoyée automatiquement au client..."
                  value={form.answer}
                  onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Article actif
              </label>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.title.trim() || !form.answer.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => { if (!v) setConfirmDeleteId(null) }}
        title="Supprimer cet article ?"
        description="Cet article sera définitivement supprimé de la base de connaissances. Cette action est irréversible."
        loading={deletingId === confirmDeleteId}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
      />

      <DeleteConfirmDialog
        open={!!confirmDeleteDoc}
        onOpenChange={(v) => { if (!v) setConfirmDeleteDoc(null) }}
        title="Supprimer ce catalogue ?"
        description={confirmDeleteDoc ? `${confirmDeleteDoc.title} et ses ${confirmDeleteDoc.row_count} article(s) seront définitivement supprimés. Cette action est irréversible.` : ''}
        loading={!!confirmDeleteDoc && deletingDocId === confirmDeleteDoc.id}
        onConfirm={() => confirmDeleteDoc && handleDeleteDocument(confirmDeleteDoc)}
      />

      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {isSpreadsheetDoc(viewingDoc) ? <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                <h2 className="font-serif font-bold truncate">{viewingDoc.title}</h2>
                <Badge variant="outline" className="text-[10px] shrink-0">{viewingDoc.row_count} {isSpreadsheetDoc(viewingDoc) ? 'article' : 'passage'}{viewingDoc.row_count > 1 ? 's' : ''}</Badge>
              </div>
              <button onClick={closeDocView}><X className="h-5 w-5 text-muted-foreground shrink-0" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingView ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />Chargement...
                </div>
              ) : isSpreadsheetDoc(viewingDoc) ? (
                viewRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune ligne restante dans ce catalogue.</p>
                ) : (
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/50 sticky top-0">
                        <tr>
                          {viewColumns.map(col => (
                            <th key={col} className="text-left px-3 py-2 font-medium whitespace-nowrap">{col}</th>
                          ))}
                          {canWriteCatalog && <th className="w-8" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewRecords.map(r => (
                          <tr key={r.id}>
                            {viewColumns.map(col => (
                              <td key={col} className="px-3 py-2 whitespace-nowrap">{r.data[col] ?? '—'}</td>
                            ))}
                            {canWriteCatalog && (
                              <td className="px-1">
                                <button
                                  onClick={() => handleDeleteRecord(r)}
                                  disabled={deletingRowId === r.id}
                                  className="text-muted-foreground hover:text-destructive p-1"
                                  title="Supprimer cette ligne"
                                >
                                  {deletingRowId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : viewChunks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun passage restant dans ce document.</p>
              ) : (
                <div className="space-y-2">
                  {viewChunks.map((c, i) => (
                    <div key={c.id} className="rounded-lg border border-border p-3 flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">#{i + 1}</Badge>
                      <p className="text-xs text-muted-foreground flex-1 whitespace-pre-wrap">{c.content}</p>
                      {canWriteCatalog && (
                        <button
                          onClick={() => handleDeleteChunk(c)}
                          disabled={deletingRowId === c.id}
                          className="text-muted-foreground hover:text-destructive p-1 shrink-0"
                          title="Supprimer ce passage"
                        >
                          {deletingRowId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {faqSourceDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <h2 className="font-serif font-bold truncate">FAQ générée depuis « {faqSourceDoc.title} »</h2>
              </div>
              <button onClick={closeFaqSuggestions}><X className="h-5 w-5 text-muted-foreground shrink-0" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="text-xs text-muted-foreground -mt-1">
                Décochez les questions à ne pas ajouter. Vous pourrez modifier chaque article ensuite depuis la liste ci-dessus.
              </p>
              {faqSuggestions.map((f, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    faqSelected.has(i) ? 'border-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={faqSelected.has(i)}
                    onChange={() => toggleFaqSelected(i)}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{f.question}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.answer}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 p-5 border-t border-border shrink-0">
              <Button variant="outline" className="flex-1 rounded-full" onClick={closeFaqSuggestions}>Annuler</Button>
              <Button
                className="flex-1 rounded-full gap-1.5"
                onClick={handleAddSelectedFaqs}
                disabled={savingFaqSuggestions || faqSelected.size === 0}
              >
                {savingFaqSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Ajouter {faqSelected.size} question{faqSelected.size > 1 ? 's' : ''} à la FAQ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
