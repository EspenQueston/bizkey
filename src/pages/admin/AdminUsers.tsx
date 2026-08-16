import { useEffect, useState } from 'react'
import {
  Search, Shield, ShieldOff, Loader2, Pencil, Trash2,
  X, Save, Crown, CreditCard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/lib/supabase'

type UserProfile = Database['public']['Tables']['profiles']['Row']

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    subscription_tier: 'free' as 'free' | 'basic' | 'pro',
    credits_remaining: 0,
    basic_credits_remaining: 0,
    advanced_credits_remaining: 0,
    payg_basic_credits: 0,
    payg_advanced_credits: 0,
    country: '',
  })

  useEffect(() => {
    loadUsers()
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
      if (error) throw error
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
    setEditForm({
      name: user.name ?? '',
      email: user.email,
      subscription_tier: user.subscription_tier as 'free' | 'basic' | 'pro',
      credits_remaining: user.credits_remaining,
      basic_credits_remaining: user.basic_credits_remaining,
      advanced_credits_remaining: user.advanced_credits_remaining,
      payg_basic_credits: user.payg_basic_credits,
      payg_advanced_credits: user.payg_advanced_credits,
      country: user.country ?? '',
    })
  }

  async function saveEdit() {
    if (!editingUser) return
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name || null,
          subscription_tier: editForm.subscription_tier,
          credits_remaining: editForm.credits_remaining,
          basic_credits_remaining: editForm.basic_credits_remaining,
          advanced_credits_remaining: editForm.advanced_credits_remaining,
          payg_basic_credits: editForm.payg_basic_credits,
          payg_advanced_credits: editForm.payg_advanced_credits,
          country: editForm.country || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingUser.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        ...editForm,
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

  async function deleteUser(userId: string) {
    if (userId === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) return
    setDeletingId(userId)
    try {
      // Delete related data first
      await supabase.from('negotiations').delete().eq('user_id', userId)
      await supabase.from('comparisons').delete().eq('user_id', userId)
      await supabase.from('analyses').delete().eq('user_id', userId)
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.filter(u => u.id !== userId))
      toast.success('Utilisateur supprimé')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors de la suppression')
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Plan</label>
                  <select
                    value={editForm.subscription_tier}
                    onChange={e => setEditForm(f => ({ ...f, subscription_tier: e.target.value as any }))}
                    className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Pays</label>
                  <Input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Crédits
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Crédits legacy</label>
                    <Input type="number" value={editForm.credits_remaining} onChange={e => setEditForm(f => ({ ...f, credits_remaining: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Basic</label>
                    <Input type="number" value={editForm.basic_credits_remaining} onChange={e => setEditForm(f => ({ ...f, basic_credits_remaining: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Advanced</label>
                    <Input type="number" value={editForm.advanced_credits_remaining} onChange={e => setEditForm(f => ({ ...f, advanced_credits_remaining: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">PAYG Basic</label>
                    <Input type="number" value={editForm.payg_basic_credits} onChange={e => setEditForm(f => ({ ...f, payg_basic_credits: parseInt(e.target.value) || 0 }))} />
                  </div>
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
                          u.subscription_tier === 'pro' ? 'border-primary/30 text-primary bg-primary/5' :
                          u.subscription_tier === 'basic' ? 'border-blue-500/30 text-blue-600 bg-blue-500/5' :
                          ''
                        }`}
                      >
                        {u.subscription_tier === 'pro' && <Crown className="h-2.5 w-2.5 mr-0.5" />}
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
                      onClick={() => deleteUser(u.id)}
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
    </div>
  )
}
