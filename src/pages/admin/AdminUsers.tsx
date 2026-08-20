import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, Shield, ShieldOff, Loader2, Pencil, Trash2,
  X, Save, Crown, Bot, Zap, XCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { supabase } from '@/lib/supabase'
import { getFunctionErrorMessage } from '@/lib/api'
import {
  getAllPlans, getAllAssistantPlans, getUserSubscription, getMyAssistantClient,
  adminAssignSourcingPlan, adminAssignAssistantPlan, syncSubscriptionStatus, getAssistantClients,
} from '@/lib/db'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/lib/supabase'
import type { Plan, AssistantPlan, Subscription, AssistantClient } from '@/lib/supabase'

type UserProfile = Database['public']['Tables']['profiles']['Row']

export default function AdminUsers() {
  const { t } = useTranslation('adminUsers')
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', country: '' })

  // Plan catalogs — fetched once, reused across every user the admin opens.
  const [sourcingPlans, setSourcingPlans] = useState<Plan[]>([])
  const [assistantPlans, setAssistantPlans] = useState<AssistantPlan[]>([])

  // "Paid" on this page has always meant "has a real Sourcing subscription
  // (subscription_tier !== 'free')" — but a business can just as well be
  // paying for BizKey WhatsApp Assistant only, which lives in a separate
  // table (assistant_clients, keyed by profile_id) that profiles.subscription_tier
  // knows nothing about. Without this map, granting/revoking an Assistant
  // plan here was invisible everywhere on this page except inside the one
  // modal that just made the change — the Free/Payants stats and the list
  // itself never reflected it, even after a full reload.
  const [assistantByProfile, setAssistantByProfile] = useState<Map<string, AssistantClient>>(new Map())

  // The editing user's *current* real state, not a hand-typed guess — and
  // the pending selection until "Appliquer" actually commits it.
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [currentAssistantClient, setCurrentAssistantClient] = useState<AssistantClient | null>(null)
  const [loadingPlanState, setLoadingPlanState] = useState(false)
  const [selectedSourcingPlanId, setSelectedSourcingPlanId] = useState('')
  const [selectedAssistantPlanId, setSelectedAssistantPlanId] = useState('')
  const [applyingSourcing, setApplyingSourcing] = useState(false)
  const [applyingAssistant, setApplyingAssistant] = useState(false)

  useEffect(() => {
    // Best-effort — catches up anyone whose subscription/assistant period
    // lapsed since the last sweep, so the plan state this page reads for
    // each user (once opened) is never reading a stale "Actif" label.
    syncSubscriptionStatus().catch(err => console.warn('syncSubscriptionStatus failed:', err))
    loadUsers()
    Promise.allSettled([getAllPlans(), getAllAssistantPlans(), getAssistantClients()]).then(([p, ap, ac]) => {
      if (p.status === 'fulfilled') setSourcingPlans(p.value.filter(x => x.is_active))
      if (ap.status === 'fulfilled') setAssistantPlans(ap.value.filter(x => x.is_active))
      if (ac.status === 'fulfilled') {
        setAssistantByProfile(new Map(ac.value.filter(c => c.profile_id).map(c => [c.profile_id as string, c])))
      }
    })
  }, [])

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      toast.error(t('toast.loadError'))
    } else {
      setUsers(data as UserProfile[])
    }
    setLoading(false)
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    if (userId === currentUser?.id) {
      toast.error(t('toast.cannotEditSelf'))
      return
    }
    setTogglingId(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: makeAdmin })
        .eq('id', userId)
      if (error) throw new Error(error.message)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: makeAdmin } : u))
      toast.success(makeAdmin ? t('toast.adminGranted') : t('toast.adminRevoked'))
    } catch {
      toast.error(t('toast.updateError'))
    } finally {
      setTogglingId(null)
    }
  }

  function openEdit(user: UserProfile) {
    setEditingUser(user)
    setEditForm({ name: user.name ?? '', email: user.email, country: user.country ?? '' })
    setCurrentSubscription(null)
    setCurrentAssistantClient(null)
    setSelectedSourcingPlanId('')
    setSelectedAssistantPlanId('')
    setLoadingPlanState(true)
    Promise.allSettled([getUserSubscription(user.id), getMyAssistantClient(user.id)]).then(([sub, ac]) => {
      if (sub.status === 'fulfilled') {
        setCurrentSubscription(sub.value)
        setSelectedSourcingPlanId(sub.value?.plan_id ?? '')
      }
      if (ac.status === 'fulfilled') {
        setCurrentAssistantClient(ac.value)
        setSelectedAssistantPlanId(ac.value?.status === 'active' ? (ac.value.plan_id ?? '') : '')
      }
    }).finally(() => setLoadingPlanState(false))
  }

  async function saveEdit() {
    if (!editingUser) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name || null,
          country: editForm.country || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingUser.id)
      if (error) throw new Error(error.message)
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        name: editForm.name || null,
        country: editForm.country || null,
        updated_at: new Date().toISOString(),
      } : u))
      toast.success(t('toast.userUpdated'))
      setEditingUser(null)
    } catch {
      toast.error(t('toast.updateFailedError'))
    }
  }

  async function applySourcingPlan() {
    if (!editingUser || !selectedSourcingPlanId) return
    setApplyingSourcing(true)
    try {
      const updatedProfile = await adminAssignSourcingPlan(editingUser.id, selectedSourcingPlanId)
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedProfile : u))
      setEditingUser(updatedProfile)
      const sub = await getUserSubscription(editingUser.id)
      setCurrentSubscription(sub)
      toast.success(t('toast.sourcingApplied'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.sourcingApplyError'))
    } finally {
      setApplyingSourcing(false)
    }
  }

  async function applyAssistantPlan(planId: string | null) {
    if (!editingUser) return
    setApplyingAssistant(true)
    try {
      const client = await adminAssignAssistantPlan(editingUser.id, planId)
      setCurrentAssistantClient(client)
      setSelectedAssistantPlanId(planId ?? '')
      // Keeps the outer list/stats in sync with what the modal just did —
      // without this, the grant only ever showed up here until the next
      // full page load.
      setAssistantByProfile(prev => {
        const next = new Map(prev)
        if (client) next.set(editingUser.id, client)
        else next.delete(editingUser.id)
        return next
      })
      toast.success(planId ? t('toast.assistantGranted') : t('toast.assistantRevoked'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.assistantApplyError'))
    } finally {
      setApplyingAssistant(false)
    }
  }

  function requestDeleteUser(user: UserProfile) {
    if (user.id === currentUser?.id) {
      toast.error(t('toast.cannotDeleteSelf'))
      return
    }
    setConfirmDeleteUser(user)
  }

  async function deleteUser(userId: string) {
    setDeletingId(userId)
    try {
      // Deletes the auth account itself (service-role only, hence the edge
      // function) — cascades to the profile and every owned record via the
      // FKs in 20260817230000_profile_deletion_cascade.sql. A plain
      // `profiles` delete used to leave the auth account able to log in
      // with no profile, and failed outright for any user with order/quote
      // history since those FKs had no cascade rule at all.
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('admin-users', {
        body: { action: 'delete', userId },
      })
      if (error) throw new Error(await getFunctionErrorMessage(error))
      if (!data?.success) throw new Error(data?.error ?? t('toast.deleteFailedGeneric'))

      setUsers(prev => prev.filter(u => u.id !== userId))
      toast.success(t('toast.userDeleted'))
      setConfirmDeleteUser(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('toast.deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (u.email ?? '').toLowerCase().includes(s) || (u.name ?? '').toLowerCase().includes(s)
  })

  // A user counts as "paying" if either product bills them — a Sourcing
  // subscription/PAYG pack (subscription_tier !== 'free') or an active
  // WhatsApp Assistant plan. Either alone is enough; this is a business
  // relationship question ("are they paying us"), not specific to one product.
  function hasActiveAssistantPlan(userId: string): boolean {
    return assistantByProfile.get(userId)?.status === 'active'
  }
  function isPayingUser(u: UserProfile): boolean {
    return u.subscription_tier !== 'free' || hasActiveAssistantPlan(u.id)
  }

  const stats = {
    total: users.length,
    admins: users.filter(u => u.is_admin).length,
    free: users.filter(u => !isPayingUser(u)).length,
    paid: users.filter(u => isPayingUser(u)).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle', { total: stats.total, paid: stats.paid, admins: stats.admins })}</p>
        </div>
        <Button variant="outline" onClick={loadUsers} size="sm" className="rounded-full">
          {t('refresh')}
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('stats.total'), value: stats.total, color: 'text-foreground' },
          { label: t('stats.admins'), value: stats.admins, color: 'text-red-600' },
          { label: t('stats.free'), value: stats.free, color: 'text-yellow-600' },
          { label: t('stats.paid'), value: stats.paid, color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
            <div className={`text-2xl font-bold font-serif ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card rounded-2xl border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                {t('modal.title')}
              </h2>
              <button onClick={() => setEditingUser(null)} className="h-8 w-8 rounded-full hover:bg-secondary grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('modal.name')}</label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('modal.email')}</label>
                  <Input value={editForm.email} disabled className="opacity-60" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('modal.country')}</label>
                <Input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
              </div>

              {/* BizKey Sourcing — the dropdown always reflects a real plans
                  row; applying it runs the exact same credit-grant logic a
                  real checkout would (subscription replaces the pool, PAYG
                  tops it up), never a hand-typed number. */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" /> {t('modal.sourcingSection')}
                </p>
                {loadingPlanState ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1"><Loader2 className="h-3 w-3 animate-spin" /> {t('modal.loading')}</div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {currentSubscription ? (
                      <>{t('modal.currentPlan')}<strong className="text-foreground">{sourcingPlans.find(p => p.id === currentSubscription.plan_id)?.display_name ?? t('modal.unknownPlan')}</strong>{' '}
                        ({currentSubscription.basic_credits_remaining} Basic · {currentSubscription.advanced_credits_remaining} Advanced)
                        {currentSubscription.expires_at && t('modal.expiresOn', { date: new Date(currentSubscription.expires_at).toLocaleDateString('fr-FR') })}
                      </>
                    ) : t('modal.currentFree')}
                    {(editingUser?.payg_basic_credits || editingUser?.payg_advanced_credits) ? (
                      t('modal.paygSuffix', { basic: editingUser?.payg_basic_credits ?? 0, advanced: editingUser?.payg_advanced_credits ?? 0 })
                    ) : null}
                  </p>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedSourcingPlanId}
                    onChange={e => setSelectedSourcingPlanId(e.target.value)}
                    className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">{t('modal.choosePlan')}</option>
                    {sourcingPlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} {p.type === 'payg' ? t('modal.payg') : t('modal.subscription')} — {p.basic_credits}B/{p.advanced_credits}A
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="rounded-full shrink-0"
                    disabled={!selectedSourcingPlanId || applyingSourcing}
                    onClick={applySourcingPlan}
                  >
                    {applyingSourcing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('modal.apply')}
                  </Button>
                </div>
              </div>

              {/* BizKey WhatsApp Assistant */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Bot className="h-3 w-3" /> {t('modal.assistantSection')}
                </p>
                {loadingPlanState ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1"><Loader2 className="h-3 w-3 animate-spin" /> {t('modal.loading')}</div>
                ) : currentAssistantClient && currentAssistantClient.status !== 'cancelled' ? (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      {t('modal.assistantCurrent')}<strong className="text-foreground">{assistantPlans.find(p => p.id === currentAssistantClient.plan_id)?.display_name ?? t('modal.unknownPlan')}</strong>
                      {t('modal.assistantStatusSuffix', { status: currentAssistantClient.status })}
                    </p>
                    <p>{t('modal.clientSince', { date: new Date(currentAssistantClient.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) })}</p>
                    <p>
                      {t('modal.currentPeriod', {
                        start: currentAssistantClient.current_period_start
                          ? new Date(currentAssistantClient.current_period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—',
                        end: currentAssistantClient.current_period_end
                          ? new Date(currentAssistantClient.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—',
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('modal.noAssistantAccess')}</p>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedAssistantPlanId}
                    onChange={e => setSelectedAssistantPlanId(e.target.value)}
                    className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">{t('modal.noAccessOption')}</option>
                    {assistantPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} — ¥{p.price_yuan}{t('modal.perMonth')}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="rounded-full shrink-0"
                    variant={selectedAssistantPlanId ? 'default' : 'outline'}
                    disabled={applyingAssistant}
                    onClick={() => applyAssistantPlan(selectedAssistantPlanId || null)}
                  >
                    {applyingAssistant ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selectedAssistantPlanId ? t('modal.apply') : <XCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="rounded-full">{t('modal.cancel')}</Button>
              <Button onClick={saveEdit} className="rounded-full gap-1"><Save className="h-4 w-4" />{t('modal.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t('empty')}</p>
          )}
          {filtered.map(u => {
            const initials = (u.name ?? u.email ?? 'U').slice(0, 2).toUpperCase()
            return (
              <Card key={u.id} className="border hover:border-primary/20 transition-colors">
                <CardContent className="py-3 flex items-center gap-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{u.name ?? t('noName')}</span>
                      {u.is_admin && <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px]">{t('admin')}</Badge>}
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          u.subscription_tier !== 'free' ? 'border-primary/30 text-primary bg-primary/5' : ''
                        }`}
                      >
                        {u.subscription_tier !== 'free' && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                        {u.subscription_tier}
                      </Badge>
                      {hasActiveAssistantPlan(u.id) && (
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-500/5 gap-0.5">
                          <Bot className="h-2.5 w-2.5" />
                          {assistantPlans.find(p => p.id === assistantByProfile.get(u.id)?.plan_id)?.display_name ?? t('assistantBadge')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{u.basic_credits_remaining ?? u.credits_remaining ?? 0}B · {u.advanced_credits_remaining ?? 0}A</span>
                      {u.country && <span>· 📍 {u.country}</span>}
                      <span>· {new Date(u.created_at).toLocaleDateString('fr')}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => openEdit(u)}
                      title={t('edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={togglingId === u.id || u.id === currentUser?.id}
                      onClick={() => toggleAdmin(u.id, !u.is_admin)}
                      className={`h-8 px-2 text-xs ${u.is_admin ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950' : ''}`}
                    >
                      {togglingId === u.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : u.is_admin ? (
                        <><ShieldOff className="h-3 w-3 mr-1" />{t('remove')}</>
                      ) : (
                        <><Shield className="h-3 w-3 mr-1" />{t('admin')}</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      disabled={u.id === currentUser?.id || deletingId === u.id}
                      onClick={() => requestDeleteUser(u)}
                      title={t('delete')}
                    >
                      {deletingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <DeleteConfirmDialog
        open={!!confirmDeleteUser}
        onOpenChange={(v) => { if (!v) setConfirmDeleteUser(null) }}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: confirmDeleteUser?.name ?? confirmDeleteUser?.email ?? '' })}
        loading={deletingId === confirmDeleteUser?.id}
        onConfirm={() => confirmDeleteUser && deleteUser(confirmDeleteUser.id)}
      />
    </div>
  )
}
