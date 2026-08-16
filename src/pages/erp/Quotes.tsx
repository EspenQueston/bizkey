import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Save, FileText, ExternalLink, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getAllQuoteRequests, updateQuoteRequest, convertQuoteToOrder, getAllUsers } from '@/lib/db'
import type { QuoteRequest, QuoteRequestStatus } from '@/lib/supabase'

const STATUS_PIPELINE: { key: QuoteRequestStatus; label: string; color: string; icon: string }[] = [
  { key: 'pending',   label: 'En attente',      color: 'bg-secondary text-secondary-foreground', icon: '⏳' },
  { key: 'reviewing', label: "En cours d'étude", color: 'bg-blue-500/15 text-blue-600',            icon: '🔍' },
  { key: 'quoted',    label: 'Devis envoyé',     color: 'bg-primary/15 text-primary',              icon: '💰' },
  { key: 'accepted',  label: 'Accepté',          color: 'bg-emerald-500/15 text-emerald-600',      icon: '✅' },
  { key: 'rejected',  label: 'Refusé',           color: 'bg-destructive/15 text-destructive',      icon: '❌' },
  { key: 'expired',   label: 'Expiré',           color: 'bg-muted text-muted-foreground',          icon: '⌛' },
]

export default function QuotesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editing, setEditing] = useState<QuoteRequest | null>(null)
  const [form, setForm] = useState({ quoted_unit_price: '', quoted_currency: 'XOF', admin_notes: '' })
  const [saving, setSaving] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([getAllQuoteRequests(), getAllUsers()]).then(([q, u]) => {
      if (q.status === 'fulfilled') setQuotes(q.value)
      if (u.status === 'fulfilled') {
        const map: Record<string, string> = {}
        for (const usr of u.value) map[usr.id] = usr.email
        setCustomers(map)
      }
    }).finally(() => setLoading(false))
  }, [])

  function openQuote(q: QuoteRequest) {
    setEditing(q)
    setForm({
      quoted_unit_price: q.quoted_unit_price != null ? String(q.quoted_unit_price) : '',
      quoted_currency: q.quoted_currency ?? 'XOF',
      admin_notes: q.admin_notes ?? '',
    })
  }

  async function markReviewing(q: QuoteRequest) {
    if (q.status !== 'pending') return
    const updated = await updateQuoteRequest(q.id, { status: 'reviewing' })
    setQuotes(prev => prev.map(x => x.id === q.id ? updated : x))
  }

  async function handleSendQuote() {
    if (!editing || !form.quoted_unit_price) return
    setSaving(true)
    try {
      const unitPrice = Number(form.quoted_unit_price)
      const updated = await updateQuoteRequest(editing.id, {
        status: 'quoted',
        quoted_unit_price: unitPrice,
        quoted_currency: form.quoted_currency,
        quoted_total: +(unitPrice * editing.quantity).toFixed(2),
        admin_notes: form.admin_notes.trim() || null,
        quoted_by: user?.id ?? null,
        quoted_at: new Date().toISOString(),
      })
      setQuotes(prev => prev.map(x => x.id === editing.id ? updated : x))
      setEditing(null)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleConvert(q: QuoteRequest) {
    if (!user) return
    setConvertingId(q.id)
    try {
      const order = await convertQuoteToOrder(q.id, user.id)
      setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, erp_order_id: order.id } : x))
      navigate('/app/orders')
    } catch (err) {
      console.error(err)
    } finally {
      setConvertingId(null)
    }
  }

  const filtered = quotes.filter(q => {
    const matchS = q.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (customers[q.customer_id] ?? '').toLowerCase().includes(search.toLowerCase())
    const matchF = statusFilter === 'all' || q.status === statusFilter
    return matchS && matchF
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold">💬 Demandes de devis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {quotes.length} demandes · {quotes.filter(q => ['pending', 'reviewing'].includes(q.status)).length} en attente de réponse
        </p>
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STATUS_PIPELINE.map(s => {
          const count = quotes.filter(q => q.status === s.key).length
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
              className={`p-2 rounded-xl border text-center transition ${statusFilter === s.key ? 'border-primary/40 bg-primary/10' : 'border-border hover:border-primary/20 bg-secondary/30'}`}
            >
              <div className="text-lg">{s.icon}</div>
              <div className={`text-lg font-bold font-serif ${count > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>{count}</div>
              <div className="text-xs text-muted-foreground leading-tight">{s.label}</div>
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher produit ou client..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{quotes.length === 0 ? 'Aucune demande de devis' : 'Aucun résultat'}</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['Client', 'Produit', 'Qté', 'Cible', 'Devis', 'Statut', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(q => {
                    const st = STATUS_PIPELINE.find(s => s.key === q.status)
                    return (
                      <tr key={q.id} className="hover:bg-secondary/20 transition">
                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-40">{customers[q.customer_id] ?? q.customer_id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-40">{q.product_name}</div>
                          {q.product_url && (
                            <a href={q.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                              Lien <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">{q.quantity}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.target_price_cny != null ? `¥${q.target_price_cny}` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-xs">
                          {q.quoted_total != null ? `${q.quoted_total.toLocaleString()} ${q.quoted_currency}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${st?.color}`}>{st?.icon} {st?.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {q.status === 'pending' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg px-2" onClick={() => markReviewing(q)}>
                                Étudier
                              </Button>
                            )}
                            {(q.status === 'pending' || q.status === 'reviewing') && (
                              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg px-2" onClick={() => openQuote(q)}>
                                Envoyer un devis
                              </Button>
                            )}
                            {q.status === 'quoted' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg px-2" onClick={() => openQuote(q)}>
                                Modifier
                              </Button>
                            )}
                            {q.status === 'accepted' && !q.erp_order_id && (
                              <Button
                                size="sm"
                                className="h-7 text-xs rounded-lg px-2 gap-1"
                                onClick={() => handleConvert(q)}
                                disabled={convertingId === q.id}
                              >
                                {convertingId === q.id
                                  ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" />
                                  : <ArrowRight className="h-3 w-3" />}
                                Créer la commande
                              </Button>
                            )}
                            {q.erp_order_id && (
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Commande créée</Badge>
                            )}
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">Envoyer un devis</h2>
              <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-sm font-medium">{editing.product_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{editing.quantity} unité{editing.quantity > 1 ? 's' : ''}
                  {editing.target_price_cny != null && ` · cible ¥${editing.target_price_cny}/unité`}</p>
                {editing.notes && <p className="text-xs text-muted-foreground italic mt-1">{editing.notes}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prix unitaire *</Label>
                  <Input type="number" step="0.01" min="0" value={form.quoted_unit_price} onChange={e => setForm(f => ({ ...f, quoted_unit_price: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Devise</Label>
                  <select
                    value={form.quoted_currency}
                    onChange={e => setForm(f => ({ ...f, quoted_currency: e.target.value }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {['XOF', 'XAF', 'USD', 'EUR', 'CNY'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {form.quoted_unit_price && (
                <p className="text-xs text-muted-foreground">
                  Total : <span className="font-semibold text-foreground">{(Number(form.quoted_unit_price) * editing.quantity).toLocaleString()} {form.quoted_currency}</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Note pour le client</Label>
                <textarea
                  rows={3}
                  placeholder="Délai de livraison estimé, conditions..."
                  value={form.admin_notes}
                  onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setEditing(null)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSendQuote} disabled={saving || !form.quoted_unit_price}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Envoyer le devis
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
