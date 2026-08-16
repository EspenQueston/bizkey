import { useEffect, useState } from 'react'
import {
  Plus, X, Save, Truck, Package, CheckCircle2,
  Clock, MapPin, Smartphone, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getERPDeliveries, getERPOrders, createERPDelivery, updateERPDelivery } from '@/lib/db'
import type { ERPDelivery, ERPOrder, ERPCountry, ERPDeliveryStatus } from '@/lib/supabase'
import { ERP_COUNTRY_INFO } from '@/lib/supabase'
import { getPaymentMethodLabel } from '@/lib/paymentMethods'

const STATUS_META: Record<ERPDeliveryStatus, { label: string; color: string; icon: string }> = {
  pending:    { label: 'En attente',    color: 'bg-secondary text-muted-foreground',   icon: '⏳' },
  dispatched: { label: 'Expédiée',      color: 'bg-blue-500/15 text-blue-600',         icon: '📦' },
  in_transit: { label: 'En transit',    color: 'bg-orange-500/15 text-orange-600',     icon: '🚢' },
  customs:    { label: 'En douane',     color: 'bg-yellow-500/15 text-yellow-700',     icon: '🏛️' },
  delivered:  { label: 'Livrée',        color: 'bg-primary/15 text-primary',           icon: '✅' },
  returned:   { label: 'Retournée',     color: 'bg-destructive/15 text-destructive',   icon: '↩️' },
}

const DELIVERY_STEPS: ERPDeliveryStatus[] = ['pending', 'dispatched', 'in_transit', 'customs', 'delivered']

const CARRIERS = [
  'COSCO Shipping', 'MSC', 'CMA CGM', 'Evergreen',
  'DHL Express', 'FedEx International', 'UPS International',
  'China Post EMS', 'SF International', 'YTO Express',
]

const EMPTY: Omit<ERPDelivery, 'id' | 'user_id' | 'created_at'> = {
  order_id: '', tracking_number: null, carrier: null, status: 'pending',
  origin_country: 'China', destination_country: 'benin', destination_city: null,
  estimated_days: null, dispatched_at: null, delivered_at: null, notes: null,
}

export default function DeliveryPage() {
  const { user } = useAuth()
  const [deliveries, setDeliveries] = useState<ERPDelivery[]>([])
  const [orders, setOrders] = useState<ERPOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [countryFilter, setCountryFilter] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    Promise.allSettled([getERPDeliveries(user.id), getERPOrders(user.id)]).then(([d, o]) => {
      if (d.status === 'fulfilled') setDeliveries(d.value)
      if (o.status === 'fulfilled') setOrders(o.value)
    }).finally(() => setLoading(false))
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const created = await createERPDelivery(user.id, form)
      setDeliveries(prev => [created, ...prev])
      setShowModal(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function handleStatusAdvance(delivery: ERPDelivery) {
    const idx = DELIVERY_STEPS.indexOf(delivery.status)
    if (idx === -1 || idx >= DELIVERY_STEPS.length - 1) return
    const newStatus = DELIVERY_STEPS[idx + 1]
    const updates: Partial<ERPDelivery> = { status: newStatus }
    if (newStatus === 'delivered') updates.delivered_at = new Date().toISOString()
    if (newStatus === 'dispatched') updates.dispatched_at = new Date().toISOString()
    const updated = await updateERPDelivery(delivery.id, updates)
    setDeliveries(prev => prev.map(d => d.id === delivery.id ? updated : d))
  }

  const filtered = countryFilter === 'all' ? deliveries : deliveries.filter(d => d.destination_country === countryFilter)

  // Live breakdown by real payment method used on the linked order — this is
  // what makes the page reflect actual payment state instead of a static list.
  const paymentBreakdown = deliveries.reduce<Record<string, number>>((acc, d) => {
    const order = orders.find(o => o.id === d.order_id)
    const label = getPaymentMethodLabel(order?.payment_method ?? null)
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">🚚 Livraisons</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {deliveries.filter(d => d.status === 'in_transit').length} en transit ·
            {' '}{deliveries.filter(d => d.status === 'customs').length} en douane ·
            {' '}{deliveries.filter(d => d.status === 'delivered').length} livrées
          </p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY }); setShowModal(true) }} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle livraison
        </Button>
      </div>

      {/* Country filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCountryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${countryFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
        >
          Tous les pays
        </button>
        {Object.entries(ERP_COUNTRY_INFO).map(([key, info]) => (
          <button
            key={key}
            onClick={() => setCountryFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${countryFilter === key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/30'}`}
          >
            {info.flag} {info.label}
          </button>
        ))}
      </div>

      {/* Country info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(ERP_COUNTRY_INFO).map(([key, info]) => {
          const cnt = deliveries.filter(d => d.destination_country === key && !['delivered','returned'].includes(d.status)).length
          return (
            <div key={key} className={`p-3 rounded-xl border ${cnt > 0 ? 'border-primary/25 bg-primary/5' : 'border-border bg-secondary/30'} text-center cursor-pointer`} onClick={() => setCountryFilter(key)}>
              <div className="text-2xl mb-1">{info.flag}</div>
              <div className="text-xs font-medium">{info.label}</div>
              <div className={`text-lg font-bold font-serif mt-0.5 ${cnt > 0 ? 'text-primary' : 'text-muted-foreground/30'}`}>{cnt}</div>
              <div className="text-xs text-muted-foreground">en cours</div>
            </div>
          )
        })}
      </div>

      {/* Payment method breakdown — dynamic, built from real orders */}
      {!loading && deliveries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-secondary/30">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            Modes de paiement :
          </span>
          {Object.entries(paymentBreakdown).map(([label, count]) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label} · {count}
            </Badge>
          ))}
        </div>
      )}

      {/* Deliveries list */}
      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune livraison</p>
          <Button onClick={() => { setForm({ ...EMPTY }); setShowModal(true) }} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />Créer</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(delivery => {
            const meta = STATUS_META[delivery.status]
            const country = ERP_COUNTRY_INFO[delivery.destination_country]
            const order = orders.find(o => o.id === delivery.order_id)
            const stepIdx = DELIVERY_STEPS.indexOf(delivery.status)
            const canAdvance = stepIdx >= 0 && stepIdx < DELIVERY_STEPS.length - 1
            // Dispatch is gated on payment confirmation for the linked order —
            // deliveries funded by mobile money shouldn't ship before the
            // transaction actually clears.
            const nextStep = canAdvance ? DELIVERY_STEPS[stepIdx + 1] : null
            const blockedByPayment = nextStep === 'dispatched' && order && !order.is_paid
            return (
              <Card key={delivery.id} className={`${delivery.status === 'in_transit' || delivery.status === 'customs' ? 'border-orange-500/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xl">{country?.flag ?? '🌍'}</span>
                        <span className="font-semibold text-sm">{order?.product_name ?? delivery.order_id.slice(0, 8)}</span>
                        <Badge className={`text-xs ${meta.color}`}>{meta.icon} {meta.label}</Badge>
                        {order && (
                          <Badge variant="outline" className={`text-xs gap-1 ${order.is_paid ? 'border-primary/30 text-primary' : 'border-yellow-500/40 text-yellow-600'}`}>
                            <Smartphone className="h-3 w-3" />
                            {getPaymentMethodLabel(order.payment_method)} · {order.is_paid ? 'Payé' : 'Non payé'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {delivery.tracking_number && (
                          <span className="flex items-center gap-1.5 font-mono">
                            <Package className="h-3 w-3" />{delivery.tracking_number}
                          </span>
                        )}
                        {delivery.carrier && <span className="flex items-center gap-1.5"><Truck className="h-3 w-3" />{delivery.carrier}</span>}
                        <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{country?.label ?? delivery.destination_country}{delivery.destination_city ? `, ${delivery.destination_city}` : ''}</span>
                        {delivery.estimated_days && <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />~{delivery.estimated_days} jours</span>}
                      </div>
                      {blockedByPayment && (
                        <p className="mt-1.5 text-xs text-yellow-600 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          Paiement non confirmé — marquez la commande comme payée avant l'expédition.
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mt-3 flex items-center gap-1">
                        {DELIVERY_STEPS.map((step, i) => {
                          const done = DELIVERY_STEPS.indexOf(delivery.status) >= i
                          return (
                            <div key={step} className="flex items-center flex-1">
                              <div className={`h-2 flex-1 rounded-full transition-all ${done ? 'bg-primary' : 'bg-border'}`} />
                              {i < DELIVERY_STEPS.length - 1 && <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? 'bg-primary' : 'bg-border'}`} />}
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-0.5 text-xs text-muted-foreground/60">
                        <span>⏳ Attente</span><span>📦 Expédiée</span><span>🚢 Transit</span><span>🏛️ Douane</span><span>✅ Livré</span>
                      </div>
                    </div>
                    {canAdvance && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full gap-1.5 text-xs flex-shrink-0"
                        onClick={() => handleStatusAdvance(delivery)}
                        disabled={!!blockedByPayment}
                        title={blockedByPayment ? 'Paiement non confirmé' : undefined}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {STATUS_META[DELIVERY_STEPS[stepIdx + 1]]?.icon} {STATUS_META[DELIVERY_STEPS[stepIdx + 1]]?.label}
                      </Button>
                    )}
                  </div>

                  {/* Country customs info */}
                  {country && (
                    <div className="mt-3 p-2.5 rounded-lg bg-secondary/40 border border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>⚓ Mer: <strong>{country.avgSeaDays}j</strong></span>
                      <span>✈️ Air: <strong>{country.avgAirDays}j</strong></span>
                      <span>🏛️ Douane: <strong>{country.customsDuty}</strong></span>
                      <span>💰 Devise: <strong>{country.currency}</strong></span>
                      <span>🏙️ Capital: <strong>{country.capital}</strong></span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">Nouvelle livraison</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>Commande associée</Label>
                <select value={form.order_id} onChange={e => setForm(f => ({...f, order_id: e.target.value}))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Sélectionner une commande</option>
                  {orders.filter(o => !['delivered','cancelled'].includes(o.status)).map(o => (
                    <option key={o.id} value={o.id}>#{o.order_number} — {o.product_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Numéro de suivi</Label>
                  <Input placeholder="Ex: COSCO123456" value={form.tracking_number ?? ''} onChange={e => setForm(f => ({...f, tracking_number: e.target.value || null}))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Transporteur</Label>
                  <select value={form.carrier ?? ''} onChange={e => setForm(f => ({...f, carrier: e.target.value || null}))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sélectionner</option>
                    {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pays de destination</Label>
                  <select value={form.destination_country} onChange={e => setForm(f => ({...f, destination_country: e.target.value as ERPCountry}))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {Object.entries(ERP_COUNTRY_INFO).map(([k, i]) => <option key={k} value={k}>{i.flag} {i.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input placeholder={ERP_COUNTRY_INFO[form.destination_country]?.capital ?? ''} value={form.destination_city ?? ''} onChange={e => setForm(f => ({...f, destination_city: e.target.value || null}))} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Délai estimé (jours)</Label>
                <Input type="number" min="1" placeholder={String(ERP_COUNTRY_INFO[form.destination_country]?.avgSeaDays ?? 30)} value={form.estimated_days ?? ''} onChange={e => setForm(f => ({...f, estimated_days: +e.target.value || null}))} className="h-10" />
                <p className="text-xs text-muted-foreground">
                  Mer: ~{ERP_COUNTRY_INFO[form.destination_country]?.avgSeaDays}j · Air: ~{ERP_COUNTRY_INFO[form.destination_country]?.avgAirDays}j
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({...f, notes: e.target.value || null}))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.order_id}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Créer la livraison
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
