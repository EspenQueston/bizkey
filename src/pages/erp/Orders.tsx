import { useEffect, useState } from 'react'
import {
  Plus, Search, Edit2, Trash2, X, Save,
  Package, UserCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { getERPOrders, getERPClients, getERPDeliveries, createERPOrder, updateERPOrder, deleteERPOrder, searchProfiles, getProfile } from '@/lib/db'
import type { ERPOrder, ERPClient, ERPDelivery, ERPCountry, ERPOrderStatus, ERPDeliveryStatus, Database } from '@/lib/supabase'
import { ERP_COUNTRY_INFO } from '@/lib/supabase'
import { getPaymentMethodsForCountry, getPaymentMethodLabel } from '@/lib/paymentMethods'

type Profile = Database['public']['Tables']['profiles']['Row']

const STATUS_PIPELINE: { key: ERPOrderStatus; label: string; color: string; icon: string }[] = [
  { key: 'draft',         label: 'Brouillon',     color: 'bg-secondary text-secondary-foreground', icon: '📝' },
  { key: 'confirmed',     label: 'Confirmée',     color: 'bg-blue-500/15 text-blue-600',          icon: '✅' },
  { key: 'in_production', label: 'Production',    color: 'bg-yellow-500/15 text-yellow-700',      icon: '🏭' },
  { key: 'shipped',       label: 'Expédiée',      color: 'bg-purple-500/15 text-purple-600',      icon: '📦' },
  { key: 'in_transit',    label: 'En transit',    color: 'bg-orange-500/15 text-orange-600',      icon: '🚢' },
  { key: 'customs',       label: 'En douane',     color: 'bg-pink-500/15 text-pink-600',          icon: '🏛️' },
  { key: 'delivered',     label: 'Livrée',        color: 'bg-primary/15 text-primary',            icon: '🎉' },
  { key: 'returned',      label: 'Retournée',     color: 'bg-destructive/15 text-destructive',    icon: '↩️' },
  { key: 'cancelled',     label: 'Annulée',       color: 'bg-destructive/15 text-destructive',    icon: '❌' },
]

// Deliveries are the single source of truth for shipping-stage progress
// (see the erp_order_delivery_sync migration) — this is display-only, kept
// separate from erp_orders.status colors above since the two enums diverge.
const DELIVERY_STATUS_META: Record<ERPDeliveryStatus, { label: string; icon: string; color: string }> = {
  pending:    { label: 'En attente', icon: '⏳', color: 'bg-secondary text-muted-foreground' },
  dispatched: { label: 'Expédiée',   icon: '📦', color: 'bg-blue-500/15 text-blue-600' },
  in_transit: { label: 'Transit',    icon: '🚢', color: 'bg-orange-500/15 text-orange-600' },
  customs:    { label: 'Douane',     icon: '🏛️', color: 'bg-yellow-500/15 text-yellow-700' },
  delivered:  { label: 'Livrée',     icon: '✅', color: 'bg-primary/15 text-primary' },
  returned:   { label: 'Retournée',  icon: '↩️', color: 'bg-destructive/15 text-destructive' },
}

const EMPTY_ORDER: Omit<ERPOrder, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  client_id: null, customer_id: null, order_number: '', status: 'draft',
  product_name: '', product_url: null, quantity: 1, unit_price: 0,
  currency: 'USD', total_amount: 0, supplier_name: null,
  destination_country: 'benin', destination_city: null,
  payment_method: null, is_paid: false, notes: null,
}

let orderCounter = 1

function genOrderNumber() {
  const d = new Date()
  return `CMD-${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2,'0')}-${String(orderCounter++).padStart(3,'0')}`
}

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<ERPOrder[]>([])
  const [clients, setClients] = useState<ERPClient[]>([])
  const [deliveries, setDeliveries] = useState<ERPDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ERPOrder | null>(null)
  const [form, setForm] = useState({ ...EMPTY_ORDER })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ERPOrder | null>(null)

  // Customer-account picker — links to a real profiles row (customer_id),
  // separate from the client_id CRM picker below which points at erp_clients
  // (contacts with no login of their own).
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Profile[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.allSettled([getERPOrders(), getERPClients(), getERPDeliveries()]).then(([o, c, d]) => {
      if (o.status === 'fulfilled') setOrders(o.value)
      if (c.status === 'fulfilled') setClients(c.value)
      if (d.status === 'fulfilled') setDeliveries(d.value)
    }).finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!showModal) return
    const q = customerQuery.trim()
    if (q.length < 2) { setCustomerResults([]); return }
    setCustomerSearching(true)
    const t = setTimeout(() => {
      searchProfiles(q)
        .then(setCustomerResults)
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery, showModal])

  function selectCustomer(p: Profile) {
    setForm(f => ({ ...f, customer_id: p.id }))
    setSelectedCustomer(p)
    setCustomerQuery('')
    setCustomerResults([])
  }

  function clearCustomer() {
    setForm(f => ({ ...f, customer_id: null }))
    setSelectedCustomer(null)
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_ORDER, order_number: genOrderNumber() })
    setSelectedCustomer(null)
    setCustomerQuery('')
    setShowModal(true)
  }

  function openEdit(order: ERPOrder) {
    setEditing(order)
    setForm({
      client_id: order.client_id, customer_id: order.customer_id, order_number: order.order_number, status: order.status,
      product_name: order.product_name, product_url: order.product_url,
      quantity: order.quantity, unit_price: order.unit_price, currency: order.currency,
      total_amount: order.total_amount, supplier_name: order.supplier_name,
      destination_country: order.destination_country, destination_city: order.destination_city,
      payment_method: order.payment_method, is_paid: order.is_paid,
      notes: order.notes,
    })
    setSelectedCustomer(null)
    setCustomerQuery('')
    setShowModal(true)
    if (order.customer_id) {
      getProfile(order.customer_id).then(setSelectedCustomer).catch(() => setSelectedCustomer(null))
    }
  }

  function updateTotal(qty: number, price: number) {
    setForm(f => ({ ...f, quantity: qty, unit_price: price, total_amount: +(qty * price).toFixed(2) }))
  }

  async function handleSave() {
    if (!user || !form.product_name.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, total_amount: +(form.quantity * form.unit_price).toFixed(2) }
      if (editing) {
        const updated = await updateERPOrder(editing.id, payload)
        setOrders(prev => prev.map(o => o.id === editing.id ? updated : o))
      } else {
        const created = await createERPOrder(user.id, payload)
        setOrders(prev => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteERPOrder(id)
      setOrders(prev => prev.filter(o => o.id !== id))
      setDeliveries(prev => prev.filter(d => d.order_id !== id))
      toast.success('Commande supprimée')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression de la commande')
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  async function quickStatus(id: string, status: ERPOrderStatus) {
    const updated = await updateERPOrder(id, { status })
    setOrders(prev => prev.map(o => o.id === id ? updated : o))
  }

  const filtered = orders.filter(o => {
    const matchS = o.product_name.toLowerCase().includes(search.toLowerCase()) || o.order_number.toLowerCase().includes(search.toLowerCase())
    const matchF = statusFilter === 'all' || o.status === statusFilter
    return matchS && matchF
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">🛒 Commandes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} commandes · {orders.filter(o => !['delivered','cancelled','returned'].includes(o.status)).length} actives</p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Button>
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-4 sm:grid-cols-9 gap-2">
        {STATUS_PIPELINE.map(s => {
          const count = orders.filter(o => o.status === s.key).length
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

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher commande..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{orders.length === 0 ? 'Aucune commande' : 'Aucun résultat'}</p>
          {orders.length === 0 && <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />Créer une commande</Button>}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {['#', 'Produit', 'Client', 'Pays', 'Paiement', 'Montant', 'Statut', 'Livraison', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(order => {
                    const st = STATUS_PIPELINE.find(s => s.key === order.status)
                    const country = ERP_COUNTRY_INFO[order.destination_country]
                    const client = clients.find(c => c.id === order.client_id)
                    const delivery = deliveries.find(d => d.order_id === order.id)
                    const dm = delivery ? DELIVERY_STATUS_META[delivery.status] : null
                    const nextStatus = STATUS_PIPELINE[STATUS_PIPELINE.findIndex(s => s.key === order.status) + 1]
                    return (
                      <tr key={order.id} className="hover:bg-secondary/20 transition">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.order_number}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate max-w-32">{order.product_name}</div>
                          <div className="text-xs text-muted-foreground">{order.quantity} × ${order.unit_price}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <div>{client?.name ?? '—'}</div>
                          {order.customer_id && (
                            <div className="flex items-center gap-1 mt-0.5 text-primary/80">
                              <UserCircle2 className="h-3 w-3" />Compte lié
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{country?.flag ?? '🌍'} {country?.label ?? order.destination_country}</td>
                        <td className="px-4 py-3 text-xs">
                          <div>{getPaymentMethodLabel(order.payment_method)}</div>
                          <Badge variant="outline" className={`mt-0.5 text-[10px] ${order.is_paid ? 'text-primary border-primary/30' : 'text-muted-foreground'}`}>
                            {order.is_paid ? '✓ Payé' : 'Non payé'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold">${order.total_amount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{order.currency}</span></td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${st?.color}`}>{st?.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {dm ? (
                            <Badge className={`text-xs ${dm.color}`}>{dm.icon} {dm.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {nextStatus && !['delivered','cancelled'].includes(order.status) && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg px-2 hover:bg-primary/10 hover:text-primary" onClick={() => quickStatus(order.id, nextStatus.key)}>
                                {nextStatus.icon} →
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={() => openEdit(order)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg hover:text-destructive" onClick={() => setConfirmDelete(order)}>
                              <Trash2 className="h-3 w-3" />
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">{editing ? 'Modifier la commande' : 'Nouvelle commande'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>N° commande</Label>
                  <Input value={form.order_number} onChange={e => setForm(f => ({...f, order_number: e.target.value}))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as ERPOrderStatus}))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    {STATUS_PIPELINE.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Produit *</Label>
                <Input placeholder="Nom du produit" value={form.product_name} onChange={e => setForm(f => ({...f, product_name: e.target.value}))} className="h-10" required />
              </div>
              <div className="space-y-1.5">
                <Label>URL produit (Alibaba/1688)</Label>
                <Input placeholder="https://..." value={form.product_url ?? ''} onChange={e => setForm(f => ({...f, product_url: e.target.value || null}))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Fournisseur</Label>
                <Input value={form.supplier_name ?? ''} onChange={e => setForm(f => ({...f, supplier_name: e.target.value || null}))} className="h-10" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantité</Label>
                  <Input type="number" min="1" value={form.quantity} onChange={e => updateTotal(+e.target.value, form.unit_price)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prix unitaire</Label>
                  <Input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => updateTotal(form.quantity, +e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Total</Label>
                  <div className="h-10 rounded-lg border border-input bg-secondary/50 px-3 flex items-center text-sm font-bold text-primary">${(form.quantity * form.unit_price).toFixed(2)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Pays de destination</Label>
                  <select
                    value={form.destination_country}
                    onChange={e => setForm(f => ({ ...f, destination_country: e.target.value as ERPCountry, payment_method: null }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(ERP_COUNTRY_INFO).map(([k, i]) => <option key={k} value={k}>{i.flag} {i.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fiche client (CRM)</Label>
                  <select value={form.client_id ?? ''} onChange={e => setForm(f => ({...f, client_id: e.target.value || null}))} className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Aucun client</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5 relative">
                <Label>Compte client connecté (optionnel)</Label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between h-10 rounded-lg border border-input bg-secondary/30 px-3 text-sm">
                    <span className="truncate flex items-center gap-1.5">
                      <UserCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {selectedCustomer.name ?? 'Sans nom'}
                      <span className="text-muted-foreground text-xs">· {selectedCustomer.email}</span>
                    </span>
                    <button type="button" onClick={clearCustomer} className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Rechercher par nom ou email..."
                      value={customerQuery}
                      onChange={e => setCustomerQuery(e.target.value)}
                      className="h-10"
                    />
                    {customerQuery.trim().length >= 2 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                        {customerSearching ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">Recherche...</div>
                        ) : customerResults.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">Aucun compte trouvé</div>
                        ) : customerResults.map(p => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => selectCustomer(p)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60 transition"
                          >
                            <div className="font-medium truncate">{p.name ?? 'Sans nom'}</div>
                            <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Lie la commande à un compte connecté (visible dans « Mes commandes » du client) — distinct de la fiche CRM ci-dessus.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Mode de paiement</Label>
                  <select
                    value={form.payment_method ?? ''}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value || null }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Non renseigné</option>
                    {getPaymentMethodsForCountry(form.destination_country).map(m => (
                      <option key={m.id} value={m.id} disabled={!m.active}>{m.name}{!m.active ? ' (indisponible)' : ''}</option>
                    ))}
                  </select>
                  {getPaymentMethodsForCountry(form.destination_country).length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun moyen de paiement mobile configuré pour ce pays.</p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm h-10 cursor-pointer">
                  <input type="checkbox" checked={form.is_paid} onChange={e => setForm(f => ({ ...f, is_paid: e.target.checked }))} />
                  Paiement confirmé
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({...f, notes: e.target.value || null}))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.product_name.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Supprimer cette commande ?"
        description={confirmDelete ? `La commande #${confirmDelete.order_number} et sa livraison associée (le cas échéant) seront définitivement supprimées.` : ''}
        loading={!!confirmDelete && deletingId === confirmDelete.id}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
      />
    </div>
  )
}
