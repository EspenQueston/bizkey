import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus, X, Save, FileText, Check, Ban, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getMyQuoteRequests, createQuoteRequest, respondToQuoteRequest } from '@/lib/db'
import type { QuoteRequest, QuoteRequestStatus, Database } from '@/lib/supabase'

type Analysis = Database['public']['Tables']['analyses']['Row']

const STATUS_INFO: Record<QuoteRequestStatus, { label: string; color: string; icon: string }> = {
  pending:   { label: 'En attente',      color: 'bg-secondary text-secondary-foreground',  icon: '⏳' },
  reviewing: { label: "En cours d'étude", color: 'bg-blue-500/15 text-blue-600',             icon: '🔍' },
  quoted:    { label: 'Devis reçu',       color: 'bg-primary/15 text-primary',               icon: '💰' },
  accepted:  { label: 'Accepté',          color: 'bg-emerald-500/15 text-emerald-600',       icon: '✅' },
  rejected:  { label: 'Refusé',           color: 'bg-destructive/15 text-destructive',       icon: '❌' },
  expired:   { label: 'Expiré',           color: 'bg-muted text-muted-foreground',           icon: '⌛' },
}

const EMPTY_FORM = {
  product_name: '', product_url: '', product_image_url: '',
  quantity: 1, target_price_cny: '', notes: '', analysis_id: null as string | null,
}

export default function MyQuotesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getMyQuoteRequests(user.id).then(setQuotes).catch(console.error).finally(() => setLoading(false))
  }, [user])

  // Prefill + auto-open from AnalysisResult's "Demander un devis" CTA
  useEffect(() => {
    const prefill = (location.state as { prefillAnalysis?: Analysis } | null)?.prefillAnalysis
    if (!prefill) return
    setForm({
      product_name: prefill.product_name ?? 'Produit à sourcer',
      product_url: prefill.product_url ?? '',
      product_image_url: prefill.raw_product_data?.images?.[0] ?? '',
      quantity: 1,
      target_price_cny: prefill.price ? String(prefill.price) : '',
      notes: '',
      analysis_id: prefill.id,
    })
    setShowModal(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  async function handleSave() {
    if (!user || !form.product_name.trim()) return
    setSaving(true)
    try {
      const created = await createQuoteRequest(user.id, {
        product_name: form.product_name.trim(),
        product_url: form.product_url.trim() || null,
        product_image_url: form.product_image_url.trim() || null,
        quantity: Math.max(1, Number(form.quantity) || 1),
        target_price_cny: form.target_price_cny ? Number(form.target_price_cny) : null,
        notes: form.notes.trim() || null,
        analysis_id: form.analysis_id,
      })
      setQuotes(prev => [created, ...prev])
      setShowModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleRespond(quoteId: string, accept: boolean) {
    setRespondingId(quoteId)
    try {
      await respondToQuoteRequest(quoteId, accept)
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: accept ? 'accepted' : 'rejected' } : q))
      // No auto-redirect to checkout here — accepting only flips the quote's
      // status. The order (and its id) doesn't exist until an admin converts
      // the accepted quote, which is when "Finaliser le paiement" appears below.
    } catch (err) {
      console.error(err)
    } finally {
      setRespondingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">💬 Mes devis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Demandez un prix ferme sur un produit — un conseiller BizKey vous répond avec une offre chiffrée.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle demande
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />
          Chargement...
        </div>
      ) : quotes.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune demande de devis</p>
          <p className="text-xs text-muted-foreground mt-1">Trouvez un produit intéressant et demandez un prix ferme.</p>
          <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />Demander un devis</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map(q => {
            const st = STATUS_INFO[q.status]
            return (
              <Card key={q.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{q.product_name}</p>
                      <p className="text-xs text-muted-foreground">{q.quantity} unité{q.quantity > 1 ? 's' : ''}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${st.color}`}>{st.icon} {st.label}</Badge>
                  </div>

                  {q.product_url && (
                    <a href={q.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      Voir le produit <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {q.target_price_cny != null && (
                    <p className="text-xs text-muted-foreground">Cible : ¥{q.target_price_cny}/unité</p>
                  )}

                  {q.status === 'quoted' && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
                      <p className="text-sm font-bold font-serif text-primary">
                        {q.quoted_total?.toLocaleString()} {q.quoted_currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {q.quoted_unit_price?.toLocaleString()} {q.quoted_currency} × {q.quantity}
                      </p>
                      {q.admin_notes && <p className="text-xs text-muted-foreground italic">{q.admin_notes}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 rounded-full gap-1 h-8 text-xs"
                          onClick={() => handleRespond(q.id, true)}
                          disabled={respondingId === q.id}
                        >
                          <Check className="h-3 w-3" /> Accepter & payer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full gap-1 h-8 text-xs"
                          onClick={() => handleRespond(q.id, false)}
                          disabled={respondingId === q.id}
                        >
                          <Ban className="h-3 w-3" /> Refuser
                        </Button>
                      </div>
                    </div>
                  )}

                  {q.status === 'accepted' && q.erp_order_id && (
                    <Button size="sm" variant="outline" className="w-full rounded-full h-8 text-xs" onClick={() => navigate(`/checkout?quote=${q.id}`)}>
                      Finaliser le paiement
                    </Button>
                  )}
                  {q.status === 'accepted' && !q.erp_order_id && (
                    <p className="text-xs text-muted-foreground italic">Commande en cours de préparation — vous pourrez bientôt payer.</p>
                  )}

                  <p className="text-[10px] text-muted-foreground/60">
                    Demandé le {new Date(q.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">Demander un devis</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>Produit *</Label>
                <Input placeholder="Nom du produit" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="h-10" required />
              </div>
              <div className="space-y-1.5">
                <Label>Lien du produit (1688 / Alibaba / Taobao)</Label>
                <Input placeholder="https://..." value={form.product_url} onChange={e => setForm(f => ({ ...f, product_url: e.target.value }))} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantité</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prix cible (¥/unité)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="Optionnel" value={form.target_price_cny} onChange={e => setForm(f => ({ ...f, target_price_cny: e.target.value }))} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  rows={3}
                  placeholder="Couleur, taille, personnalisation, délai souhaité..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.product_name.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Envoyer la demande
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
