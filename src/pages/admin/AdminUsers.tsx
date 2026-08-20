import { useEffect, useState } from 'react'
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
  adminAssignSourcingPlan, adminAssignAssistantPlan, syncSubscriptionStatus,
} from '@/lib/db'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/lib/supabase'
import type { Plan, AssistantPlan, Subscription, AssistantClient } from '@/lib/supabase'

type UserProfile = Database['public']['Tables']['profiles']['Row']

export default function AdminUsers() {
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
    Promise.allSettled([getAllPlans(), getAllAssistantPlans()]).then(([p, ap]) => {
      if (p.status === 'fulfilled') setSourcingPlans(p.value.filter(x => x.is_active))
      if (ap.status === 'fulfilled') setAssistantPlans(ap.value.filter(x => x.is_active))
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
      toast.error('Erreur lors du chargement des utilisateurs')
    } else {
      setUsers(data as UserProfile[])
    }
    setLoading(false)
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    if (userId === currentUser?.id) {
      toast.error('Vous ne pouvez pas modifier votre propre rôle')
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
      toast.success(makeAdmin ? 'Admin accordé' : 'Admin retiré')
    } catch {
      toast.error('Erreur lors de la modification')
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
      toast.success('Utilisateur mis à jour')
      setEditingUser(null)
    } catch {
      toast.error('Erreur lors de la mise à jour')
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
      toast.success('Formule BizKey Sourcing appliquée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'attribution de la formule")
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
      toast.success(planId ? 'Accès BizKey WhatsApp Assistant accordé' : 'Accès BizKey WhatsApp Assistant révoqué')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'attribution de l'assistant")
    } finally {
      setApplyingAssistant(false)
    }
  }

  function requestDeleteUser(user: UserProfile) {
    if (user.id === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
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
      if (!data?.success) throw new Error(data?.error ?? 'Échec de la suppression')

      setUsers(prev => prev.filter(u => u.id !== userId))
      toast.success('Utilisateur supprimé')
      setConfirmDeleteUser(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return (u.email ?? '').toLowerCase().includes(s) || (u.name ?? '').toLowerCase().includes(s)
  })

  const stats = {
    total: users.length,
    admins: users.filter(u => u.is_admin).length,
    free: users.filter(u => u.subscription_tier === 'free').length,
    paid: users.filter(u => u.subscription_tier !== 'free').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground text-sm">CRUD complet — {stats.total} utilisateurs ({stats.paid} payants, {stats.admins} admins)</p>
        </div>
        <Button variant="outline" onClick={loadUsers} size="sm" className="rounded-full">
          Rafraîchir
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Admins', value: stats.admins, color: 'text-red-600' },
          { label: 'Free', value: stats.free, color: 'text-yellow-600' },
          { label: 'Payants', value: stats.paid, color: 'text-primary' },
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
        <Input className="pl-9" placeholder="Rechercher par email ou nom…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card rounded-2xl border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                Modifier l'utilisateur
              </h2>
              <button onClick={() => setEditingUser(null)} className="h-8 w-8 rounded-full hover:bg-secondary grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nom</label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input value={editForm.email} disabled className="opacity-60" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pays</label>
                <Input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
              </div>

              {/* BizKey Sourcing — the dropdown always reflects a real plans
                  row; applying it runs the exact same credit-grant logic a
                  real checkout would (subscription replaces the pool, PAYG
                  tops it up), never a hand-typed number. */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" /> BizKey Sourcing
                </p>
                {loadingPlanState ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1"><Loader2 className="h-3 w-3 animate-spin" /> Chargement…</div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {currentSubscription ? (
                      <>Actuel : <strong className="text-foreground">{sourcingPlans.find(p => p.id === currentSubscription.plan_id)?.display_name ?? 'Formule inconnue'}</strong>{' '}
                        ({currentSubscription.basic_credits_remaining} Basic · {currentSubscription.advanced_credits_remaining} Advanced)
                        {currentSubscription.expires_at && ` — expire le ${new Date(currentSubscription.expires_at).toLocaleDateString('fr-FR')}`}
                      </>
                    ) : 'Actuel : Free (aucun abonnement actif)'}
                    {(editingUser?.payg_basic_credits || editingUser?.payg_advanced_credits) ? (
                      <> · PAYG : {editingUser?.payg_basic_credits ?? 0} Basic · {editingUser?.payg_advanced_credits ?? 0} Advanced</>
                    ) : null}
                  </p>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedSourcingPlanId}
                    onChange={e => setSelectedSourcingPlanId(e.target.value)}
                    className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Choisir une formule…</option>
                    {sourcingPlans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} {p.type === 'payg' ? '(PAYG)' : '(Abonnement)'} — {p.basic_credits}B/{p.advanced_credits}A
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="rounded-full shrink-0"
                    disabled={!selectedSourcingPlanId || applyingSourcing}
                    onClick={applySourcingPlan}
                  >
                    {applyingSourcing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer'}
                  </Button>
                </div>
              </div>

              {/* BizKey WhatsApp Assistant */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Bot className="h-3 w-3" /> BizKey WhatsApp Assistant
                </p>
                {loadingPlanState ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-1"><Loader2 className="h-3 w-3 animate-spin" /> Chargement…</div>
                ) : currentAssistantClient && currentAssistantClient.status !== 'cancelled' ? (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Actuel : <strong className="text-foreground">{assistantPlans.find(p => p.id === currentAssistantClient.plan_id)?.display_name ?? 'Formule inconnue'}</strong>
                      {' '}— statut {currentAssistantClient.status}
                    </p>
                    <p>Client depuis le {new Date(currentAssistantClient.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p>
                      Période en cours : {currentAssistantClient.current_period_start
                        ? new Date(currentAssistantClient.current_period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                      {' → '}
                      {currentAssistantClient.current_period_end
                        ? new Date(currentAssistantClient.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun accès Assistant WhatsApp</p>
                )}
                <div className="flex gap-2">
                  <select
                    value={selectedAssistantPlanId}
                    onChange={e => setSelectedAssistantPlanId(e.target.value)}
                    className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">— Aucun accès —</option>
                    {assistantPlans.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} — ¥{p.price_yuan}/mois</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="rounded-full shrink-0"
                    variant={selectedAssistantPlanId ? 'default' : 'outline'}
                    disabled={applyingAssistant}
                    onClick={() => applyAssistantPlan(selectedAssistantPlanId || null)}
                  >
                    {applyingAssistant ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selectedAssistantPlanId ? 'Appliquer' : <XCircle className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="rounded-full">Annuler</Button>
              <Button onClick={saveEdit} className="rounded-full gap-1"><Save className="h-4 w-4" />Sauvegarder</Button>
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
            <p className="text-center text-muted-foreground py-8">Aucun utilisateur trouvé</p>
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
                      <span className="font-medium text-sm truncate">{u.name ?? 'Sans nom'}</span>
                      {u.is_admin && <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px]">Admin</Badge>}
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          u.subscription_tier !== 'free' ? 'border-primary/30 text-primary bg-primary/5' : ''
                        }`}
                      >
                        {u.subscription_tier !== 'free' && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                        {u.subscription_tier}
                      </Badge>
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
                      title="Modifier"
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
                        <><ShieldOff className="h-3 w-3 mr-1" />Retirer</>
                      ) : (
                        <><Shield className="h-3 w-3 mr-1" />Admin</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      disabled={u.id === currentUser?.id || deletingId === u.id}
                      onClick={() => requestDeleteUser(u)}
                      title="Supprimer"
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
        title="Supprimer cet utilisateur ?"
        description={`${confirmDeleteUser?.name ?? confirmDeleteUser?.email ?? ''} sera définitivement supprimé — compte, analyses, commandes, paiements et abonnement associés. Cette action est irréversible.`}
        loading={deletingId === confirmDeleteUser?.id}
        onConfirm={() => confirmDeleteUser && deleteUser(confirmDeleteUser.id)}
      />
    </div>
  )
}
