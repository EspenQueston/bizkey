import { useEffect, useState } from 'react'
import { Plus, X, Save, BookOpen, Trash2, Edit2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { getWhatsAppKbArticles, createWhatsAppKbArticle, updateWhatsAppKbArticle, deleteWhatsAppKbArticle } from '@/lib/db'
import { useAuth } from '@/contexts/AuthContext'
import type { WhatsAppKbArticle } from '@/lib/supabase'

const EMPTY = { title: '', keywords: '', answer: '', is_active: true }

export default function WhatsAppKnowledgeBasePage() {
  const { profile, assistantClient } = useAuth()
  const isAdmin = profile?.is_admin === true
  const [articles, setArticles] = useState<WhatsAppKbArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WhatsAppKbArticle | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
    </div>
  )
}
