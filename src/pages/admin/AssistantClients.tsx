import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Edit2, Trash2, X, Save, Phone, Mail, Building2, Smartphone, CalendarClock, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import {
  getAssistantClients, createAssistantClient, updateAssistantClient, deleteAssistantClient,
  getAllAssistantPlans, getWhatsAppNumbers, syncSubscriptionStatus, getUsageSummaryAllTenants, getAllUsers,
} from '@/lib/db'
import { toast } from 'sonner'
import type { AssistantClient, AssistantClientStatus, AssistantPlan, WhatsAppNumber } from '@/lib/supabase'

const EMPTY: Omit<AssistantClient, 'id' | 'created_at' | 'updated_at'> = {
  company_name: '', contact_name: null, contact_email: null, contact_phone: null,
  status: 'trial', plan_id: null, whatsapp_number_id: null, notes: null,
  // Owner self-service fields (tone/hours/number-request), onboarding-wizard
  // fields (sector/country/onboarding_completed_at), and billing-period
  // dates aren't edited from this admin CRM form — left at their defaults on
  // create, and preserved as-is (never reset) when editing below.
  profile_id: null, tone: 'professional', business_hours: null, requested_whatsapp_number: null,
  current_period_start: null, current_period_end: null,
  sector: null, country: null, onboarding_completed_at: null,
}

export default function AssistantClientsPage() {
  const { t } = useTranslation('adminAssistantClients')
  const STATUS_META: Record<AssistantClientStatus, { label: string; color: string }> = {
    trial:     { label: t('status.trial'),     color: 'bg-blue-500/15 text-blue-600' },
    active:    { label: t('status.active'),    color: 'bg-primary/15 text-primary' },
    suspended: { label: t('status.suspended'), color: 'bg-amber-500/15 text-amber-600' },
    cancelled: { label: t('status.cancelled'), color: 'bg-destructive/15 text-destructive' },
    expired:   { label: t('status.expired'),   color: 'bg-secondary text-muted-foreground' },
  }
  const [clients, setClients] = useState<AssistantClient[]>([])
  const [plans, setPlans] = useState<AssistantPlan[]>([])
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  // Real (unmarked-up) AI spend per business over the last 30 days — the
  // admin's own view of cost, distinct from the ×10 display figure a
  // business owner sees on their own Billing page (AssistantBilling.tsx).
  const [costByClient, setCostByClient] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AssistantClient | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AssistantClient | null>(null)

  useEffect(() => {
    // Best-effort, awaited before the list loads — a business whose period
    // lapsed since the last hourly sweep should show "Expiré" the moment an
    // admin opens this page, not whatever stale status it had before.
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    syncSubscriptionStatus().catch(err => console.warn('syncSubscriptionStatus failed:', err)).finally(() => {
      Promise.allSettled([
        getAssistantClients(), getAllAssistantPlans(), getWhatsAppNumbers(), getUsageSummaryAllTenants(since30d), getAllUsers(),
      ]).then(([c, p, n, usage, users]) => {
        if (c.status === 'fulfilled') {
          // Staff already get unlimited platform access via the is_admin
          // bypass in the sidebar (never reads a real plan row) — a real
          // assistant_clients row on an admin's own account only ever
          // exists as internal-testing leftover, never a genuine customer
          // relationship, so it's excluded here rather than shown as if
          // it were one of "your businesses".
          const adminIds = users.status === 'fulfilled'
            ? new Set(users.value.filter(u => u.is_admin).map(u => u.id))
            : new Set<string>()
          setClients(c.value.filter(client => !client.profile_id || !adminIds.has(client.profile_id)))
        }
        if (p.status === 'fulfilled') setPlans(p.value)
        if (n.status === 'fulfilled') setNumbers(n.value)
        if (usage.status === 'fulfilled') {
          const byClient = new Map<string, number>()
          for (const row of usage.value) {
            if (!row.client_id) continue
            byClient.set(row.client_id, (byClient.get(row.client_id) ?? 0) + row.total_cost)
          }
          setCostByClient(byClient)
        }
      }).finally(() => setLoading(false))
    })
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY })
    setShowModal(true)
  }

  function openEdit(c: AssistantClient) {
    setEditing(c)
    setForm({
      company_name: c.company_name, contact_name: c.contact_name, contact_email: c.contact_email,
      contact_phone: c.contact_phone, status: c.status, plan_id: c.plan_id,
      whatsapp_number_id: c.whatsapp_number_id, notes: c.notes,
      // Preserved as-is — this form has no fields for them, so carrying the
      // existing values through prevents a save here from silently wiping
      // what the owner set themselves (or what the billing RPCs stamped).
      profile_id: c.profile_id, tone: c.tone, business_hours: c.business_hours,
      requested_whatsapp_number: c.requested_whatsapp_number,
      current_period_start: c.current_period_start, current_period_end: c.current_period_end,
      sector: c.sector, country: c.country, onboarding_completed_at: c.onboarding_completed_at,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.company_name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const updated = await updateAssistantClient(editing.id, form)
        setClients(prev => prev.map(c => c.id === editing.id ? updated : c))
      } else {
        const created = await createAssistantClient(form)
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
    setDeletingId(id)
    try {
      await deleteAssistantClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success(t('deletedToast'))
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('deleteError'))
    } finally {
      setDeletingId(null)
      setConfirmDelete(null)
    }
  }

  const filtered = clients.filter(c => {
    const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('summary', { count: clients.length })} · {t('activeSubs', { count: clients.filter(c => c.status === 'active').length })}
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-full gap-2">
          <Plus className="h-4 w-4" />
          {t('newClient')}
        </Button>
      </div>

      <Card className="border-blue-500/25 bg-blue-500/5">
        <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
          {t('infoBanner')}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{t('allStatuses')}</option>
          {(Object.keys(STATUS_META) as AssistantClientStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{clients.length === 0 ? t('empty') : t('noResults')}</p>
          {clients.length === 0 && <Button onClick={openCreate} size="sm" className="mt-3 rounded-full"><Plus className="h-4 w-4 mr-1" />{t('addClient')}</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(client => {
            const meta = STATUS_META[client.status]
            const plan = plans.find(p => p.id === client.plan_id)
            const number = numbers.find(n => n.id === client.whatsapp_number_id)
            return (
              <Card key={client.id} className="hover:border-primary/30 transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-blue-500/10 grid place-items-center flex-shrink-0">
                        <Building2 className="h-4.5 w-4.5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{client.company_name}</div>
                        {client.contact_name && <div className="text-xs text-muted-foreground truncate">{client.contact_name}</div>}
                      </div>
                    </div>
                    <Badge className={`text-xs flex-shrink-0 ${meta.color}`}>{meta.label}</Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {client.contact_email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 flex-shrink-0" />{client.contact_email}</div>}
                    {client.contact_phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 flex-shrink-0" />{client.contact_phone}</div>}
                    {number && <div className="flex items-center gap-2"><Smartphone className="h-3 w-3 flex-shrink-0" />{number.phone_number}</div>}
                    <div className="flex items-center gap-2"><CalendarClock className="h-3 w-3 flex-shrink-0" />{t('customerSince', { date: new Date(client.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) })}</div>
                    {client.current_period_start && client.current_period_end && (
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-3 w-3 flex-shrink-0" />
                        {t('period', {
                          start: new Date(client.current_period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                          end: new Date(client.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {plan && (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">{plan.display_name}</Badge>
                    )}
                    {costByClient.has(client.id) && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 gap-1">
                        <Sparkles className="h-2.5 w-2.5" />
                        {t('realAiCost', { cost: costByClient.get(client.id)!.toFixed(4) })}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 h-8 rounded-lg text-xs gap-1" onClick={() => openEdit(client)}>
                      <Edit2 className="h-3 w-3" />{t('edit')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg hover:text-destructive hover:border-destructive/30" onClick={() => setConfirmDelete(client)} disabled={deletingId === client.id}>
                      {deletingId === client.id ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold">{editing ? t('modal.editTitle') : t('modal.createTitle')}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label>{t('modal.company')}</Label>
                <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('modal.contact')}</Label>
                  <Input value={form.contact_name ?? ''} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value || null }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('modal.phone')}</Label>
                  <Input value={form.contact_phone ?? ''} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value || null }))} className="h-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.email')}</Label>
                <Input type="email" value={form.contact_email ?? ''} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value || null }))} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('modal.plan')}</Label>
                  <select
                    value={form.plan_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, plan_id: e.target.value || null }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">{t('modal.none')}</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('modal.status')}</Label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as AssistantClientStatus }))}
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(Object.keys(STATUS_META) as AssistantClientStatus[]).map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.whatsappNumber')}</Label>
                <select
                  value={form.whatsapp_number_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, whatsapp_number_id: e.target.value || null }))}
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t('modal.noNumber')}</option>
                  {numbers.map(n => <option key={n.id} value={n.id}>{n.label} — {n.phone_number}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('modal.notes')}</Label>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowModal(false)}>{t('modal.cancel')}</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSave} disabled={saving || !form.company_name.trim()}>
                {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                {t('modal.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(null) }}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: confirmDelete?.company_name ?? '' })}
        loading={deletingId === confirmDelete?.id}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
      />
    </div>
  )
}
