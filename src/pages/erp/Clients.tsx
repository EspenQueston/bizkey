import { useEffect, useState } from 'react'
import {
  Plus, Search, Edit2, Trash2, X, Save, Phone,
  Mail, MapPin, Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getERPClients, createERPClient, updateERPClient, deleteERPClient } from '@/lib/db'
import type { ERPClient, ERPCountry } from '@/lib/supabase'
import { ERP_COUNTRY_INFO } from '@/lib/supabase'

const EMPTY: Omit<ERPClient, 'id' | 'user_id' | 'created_at'> = {
  name: '', email: null, phone: null, country: 'benin', city: null,
  company: null, notes: null, status: 'prospect',
}

const STATUS_META = {
  active:   { label: 'Actif',     color: 'bg-primary/15 text-primary' },
  inactive: { label: 'Inactif',   color: 'bg-secondary text-muted-foreground' },
  prospect: { label: 'Prospect',  color: 'bg-yellow-500/15 text-yellow-700' },
}

export default function ClientsPage() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ERPClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ERPClient | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getERPClients(user.id)
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowModal(true)
  }

  function openEdit(client: ERPClient) {
    setEditing(client)
    setForm({
      name: client.name, email: client.email, phone: client.phone,
      country: client.country, city: client.city, company: client.company,
      notes: client.notes, status: client.status,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!user || !form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateERPClient(editing.id, form)
        setClients(prev => prev.map(c => c.id === editing.id ? updated : c))
      } else {
        const created = await createERPClient(user.id, form)
        setClients(prev => [created, ...prev])
      }
      setShowModal(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce client ?')) return
    setDeletingId(id)
    try {
      await deleteERPClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">👥 Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} clients enregistrés</p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          Nouveau client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="prospect">Prospects</option>
          <option value="inactive">Inactifs</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{clients.length === 0 ? 'Aucun client pour l\'instant' : 'Aucun résultat'}</p>
          {clients.length === 0 && (
            <Button onClick={openCreate} size="sm" className="mt-3 rounded-full">
              <Plus className="h-4 w-4 mr-1" />Ajouter un client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(client => {
            const country = ERP_COUNTRY_INFO[client.country]
            const meta = STATUS_META[client.status]
            return (
              <Card key={client.id} className="hover:border-primary/30 transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-lg flex-shrink-0">
                        {country?.flag ?? '🌍'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{client.name}</div>
                        {client.company && <div className="text-xs text-muted-foreground truncate">{client.company}</div>}
                      </div>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${meta.color}`}>{meta.label}</Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {client.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 flex-shrink-0" />{client.email}</div>}
                    {client.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 flex-shrink-0" />{client.phone}</div>}
                    <div className="flex items-center gap-2"><MapPin className="h-3 w-3 flex-shrink-0" />{country?.label ?? client.country}{client.city ? `, ${client.city}` : ''}</div>
                  </div>
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 h-8 rounded-lg text-xs gap-1" onClick={() => openEdit(client)}>
                      <Edit2 className="h-3 w-3" />Modifier
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg hover:text-destructive hover:border-destructive/30" onClick={() => handleDelete(client.id)} disabled={deletingId === client.id}>
                      {deletingId === client.id ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
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
              <h2 className="font-serif font-bold">{editing ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { id: 'name', label: 'Nom complet *', key: 'name', type: 'text', req: true },
                { id: 'company', label: 'Entreprise', key: 'company', type: 'text', req: false },
                { id: 'email', label: 'Email', key: 'email', type: 'email', req: false },
                { id: 'phone', label: 'Téléphone', key: 'phone', type: 'tel', req: false },
                { id: 'city', label: 'Ville', key: 'city', type: 'text', req: false },
              ].map(field => (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    type={field.type}
                    value={(form as Record<string, string | null>)[field.key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value || null }))}
                    className="h-10"
                    required={field.req}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <select
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value as ERPCountry }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(ERP_COUNTRY_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.flag} {info.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as ERPClient['status'] }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
