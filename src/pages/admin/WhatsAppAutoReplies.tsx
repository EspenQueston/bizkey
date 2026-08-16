import { useEffect, useState } from 'react'
import { Plus, X, Save, Bot, Trash2, Edit2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { getWhatsAppAutoReplies, createWhatsAppAutoReply, updateWhatsAppAutoReply, deleteWhatsAppAutoReply, getWhatsAppKbArticles } from '@/lib/db'
import { useAuth } from '@/contexts/AuthContext'
import { matchAutoReply, type BotMatchResult } from '@/lib/whatsappBot'
import type { WhatsAppAutoReply, WhatsAppKbArticle, WhatsAppTriggerType } from '@/lib/supabase'

const TRIGGER_META: Record<WhatsAppTriggerType, { label: string; icon: string; color: string }> = {
  greeting: { label: 'Salutation',        icon: '👋', color: 'bg-blue-500/15 text-blue-600' },
  keyword:  { label: 'Mot-clé',           icon: '🔑', color: 'bg-violet-500/15 text-violet-600' },
  fallback: { label: 'Réponse par défaut', icon: '💬', color: 'bg-amber-500/15 text-amber-600' },
}

const EMPTY = {
  trigger_type: 'keyword' as WhatsAppTriggerType,
  trigger_value: '',
  responseMode: 'text' as 'text' | 'kb',
  response_text: '',
  kb_article_id: '',
  is_active: true,
}

export default function WhatsAppAutoRepliesPage() {
  const { profile, assistantClient } = useAuth()
  const isAdmin = profile?.is_admin === true
  const myClientId = assistantClient?.id ?? null
  const [rules, setRules] = useState<WhatsAppAutoReply[]>([])
  const [kbArticles, setKbArticles] = useState<WhatsAppKbArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WhatsAppAutoReply | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [testMessage, setTestMessage] = useState('')
  const [testResult, setTestResult] = useState<BotMatchResult | null | 'none-tested'>('none-tested')

  useEffect(() => {
    // Same-tenant-only scoping as the KB page: a business owner's rules and
    // eligible KB articles must both be their own — an auto-reply can never
    // point at another tenant's article (enforced server-side too, by
    // check_auto_reply_kb_article_tenant).
    Promise.allSettled([getWhatsAppAutoReplies(), getWhatsAppKbArticles()]).then(([r, kb]) => {
      if (r.status === 'fulfilled') setRules(isAdmin ? r.value : r.value.filter(rule => rule.client_id === myClientId))
      if (kb.status === 'fulfilled') setKbArticles(isAdmin ? kb.value : kb.value.filter(a => a.client_id === myClientId))
    }).finally(() => setLoading(false))
  }, [isAdmin, myClientId])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowModal(true)
  }

  function openEdit(r: WhatsAppAutoReply) {
    setEditing(r)
    setForm({
      trigger_type: r.trigger_type,
      trigger_value: r.trigger_value ?? '',
      responseMode: r.kb_article_id ? 'kb' : 'text',
      response_text: r.response_text ?? '',
      kb_article_id: r.kb_article_id ?? '',
      is_active: r.is_active,
    })
    setShowModal(true)
  }

  async function handleSave() {
    const usesKb = form.responseMode === 'kb'
    if (form.trigger_type !== 'fallback' && !form.trigger_value.trim()) return
    if (usesKb && !form.kb_article_id) return
    if (!usesKb && !form.response_text.trim()) return
    setSaving(true)
    try {
      const payload = {
        trigger_type: form.trigger_type,
        trigger_value: form.trigger_type === 'fallback' ? null : form.trigger_value.trim(),
        response_text: usesKb ? null : form.response_text.trim(),
        kb_article_id: usesKb ? form.kb_article_id : null,
        is_active: form.is_active,
        sort_order: editing?.sort_order ?? rules.length,
      }
      if (editing) {
        const updated = await updateWhatsAppAutoReply(editing.id, payload)
        setRules(prev => prev.map(r => r.id === editing.id ? updated : r))
      } else {
        const created = await createWhatsAppAutoReply({ ...payload, client_id: isAdmin ? null : myClientId })
        setRules(prev => [...prev, created])
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
      await deleteWhatsAppAutoReply(id)
      setRules(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  function runTest() {
    if (!testMessage.trim()) return
    setTestResult(matchAutoReply(testMessage, rules, kbArticles))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">🤖 Réponses automatiques</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rules.length} règle{rules.length !== 1 ? 's' : ''} · {rules.filter(r => r.is_active).length} active{rules.filter(r => r.is_active).length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle règle
        </Button>
      </div>

      {/* Live bot simulator */}
      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Testez l'assistant
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Tapez un message client, ex: Bonjour, quels sont vos délais ?"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runTest()}
              className="h-10 bg-background"
            />
            <Button onClick={runTest} className="rounded-full gap-1.5 shrink-0" disabled={!testMessage.trim()}>
              <Send className="h-3.5 w-3.5" /> Tester
            </Button>
          </div>
          {testResult === 'none-tested' ? null : testResult === null ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Aucune règle ne correspond — le client serait transféré à un agent humain.
            </div>
          ) : (
            <div className="rounded-xl border border-primary/25 bg-background p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <Badge className={`text-[10px] ${TRIGGER_META[testResult.rule.trigger_type].color}`}>
                  {TRIGGER_META[testResult.rule.trigger_type].icon} {TRIGGER_META[testResult.rule.trigger_type].label}
                </Badge>
              </div>
              <p className="text-sm">{testResult.responseText}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : rules.length === 0 ? (
        <div className="py-16 text-center">
          <Bot className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune règle configurée</p>
          <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />Créer une règle</Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['Déclencheur', 'Valeur', 'Réponse', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map(r => {
                    const meta = TRIGGER_META[r.trigger_type]
                    const kb = r.kb_article_id ? kbArticles.find(a => a.id === r.kb_article_id) : null
                    return (
                      <tr key={r.id} className="hover:bg-secondary/20 transition">
                        <td className="px-4 py-3"><Badge className={`text-xs ${meta.color}`}>{meta.icon} {meta.label}</Badge></td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.trigger_value ?? '—'}</td>
                        <td className="px-4 py-3 text-xs max-w-64 truncate">{kb ? `📚 ${kb.title}` : r.response_text}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-[10px] ${r.is_active ? 'text-primary border-primary/30' : 'text-muted-foreground'}`}>
                            {r.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => openEdit(r)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:text-destructive" onClick={() => setConfirmDeleteId(r.id)} disabled={deletingId === r.id}>
                              {deletingId === r.id ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">{editing ? 'Modifier la règle' : 'Nouvelle règle'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>Déclencheur</Label>
                <select
                  value={form.trigger_type}
                  onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as WhatsAppTriggerType }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(Object.keys(TRIGGER_META) as WhatsAppTriggerType[]).map(t => (
                    <option key={t} value={t}>{TRIGGER_META[t].icon} {TRIGGER_META[t].label}</option>
                  ))}
                </select>
              </div>
              {form.trigger_type !== 'fallback' && (
                <div className="space-y-1.5">
                  <Label>{form.trigger_type === 'keyword' ? 'Mot-clé à détecter *' : 'Optionnel — laissé vide, détecte tout salut usuel'}</Label>
                  <Input
                    placeholder={form.trigger_type === 'keyword' ? 'Ex: livraison, prix, délai' : 'bonjour'}
                    value={form.trigger_value}
                    onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                    className="h-10"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Type de réponse</Label>
                <div className="inline-flex p-1 rounded-full bg-muted border border-border">
                  {(['text', 'kb'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, responseMode: mode }))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                        form.responseMode === mode ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode === 'text' ? 'Texte libre' : 'Article de la base de connaissances'}
                    </button>
                  ))}
                </div>
              </div>
              {form.responseMode === 'text' ? (
                <div className="space-y-1.5">
                  <Label>Réponse *</Label>
                  <textarea
                    rows={4}
                    placeholder="La réponse envoyée automatiquement..."
                    value={form.response_text}
                    onChange={e => setForm(f => ({ ...f, response_text: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Article *</Label>
                  <select
                    value={form.kb_article_id}
                    onChange={e => setForm(f => ({ ...f, kb_article_id: e.target.value }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sélectionner un article</option>
                    {kbArticles.filter(a => a.is_active).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                  </select>
                  {kbArticles.filter(a => a.is_active).length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun article actif — créez-en un dans la Base de connaissances.</p>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Règle active
              </label>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving}>
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
        title="Supprimer cette règle ?"
        description="Cette règle de réponse automatique sera définitivement supprimée. Cette action est irréversible."
        loading={deletingId === confirmDeleteId}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
      />
    </div>
  )
}
