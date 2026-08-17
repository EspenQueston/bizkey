import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User, Mail, Calendar, Crown, Zap, Star,
  TrendingUp, MessageSquare, GitCompare, Edit2, Save, X,
  Shield, LogOut, Camera
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfile } from '@/lib/db'

const PLAN_META = {
  free:  { label: 'Gratuit',  color: 'bg-secondary text-secondary-foreground', desc: '3 analyses incluses', icon: null },
  basic: { label: 'Basic',    color: 'bg-blue-500/15 text-blue-600 border-blue-500/25', desc: '50 analyses/mois', icon: Zap },
  pro:   { label: 'Pro',      color: 'bg-primary/15 text-primary border-primary/25', desc: 'Analyses illimitées', icon: Crown },
}

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isAdmin = profile?.is_admin === true
  const tier = (profile?.subscription_tier ?? 'free') as 'free' | 'basic' | 'pro'
  const planMeta = PLAN_META[tier]
  // While editing, the header reflects the in-progress name live instead of
  // the last-saved one — see the change before you commit to it.
  const displayName = editing ? (name.trim() || 'Utilisateur') : (profile?.name ?? 'Utilisateur')
  const initials = (editing ? name.trim() : profile?.name) || profile?.email || 'U'
  const initialsShort = initials.slice(0, 2).toUpperCase()
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
    : '—'

  async function handleSave() {
    if (!user || !name.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateProfile(user.id, { name: name.trim() })
      await refreshProfile()
      setEditing(false)
      setSuccess('Profil mis à jour')
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── PROFILE CARD ── */}
        <Card className="overflow-hidden">
          {/* Banner */}
          <div className="h-28 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12 mb-6">
              <div className="relative">
                <Avatar className={`h-20 w-20 ring-4 ring-background shadow-xl transition-all ${editing ? 'ring-primary/40' : ''}`}>
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">{initialsShort}</AvatarFallback>
                </Avatar>
                <button className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-secondary border border-border grid place-items-center hover:bg-primary hover:text-primary-foreground transition">
                  <Camera className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 sm:mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-xl font-bold">{displayName}</h1>
                  <Badge variant="outline" className={planMeta.color}>
                    {planMeta.icon && <planMeta.icon className="h-3 w-3 mr-1" />}
                    {planMeta.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{profile?.email ?? user?.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => { setEditing(!editing); setName(profile?.name ?? '') }}
              >
                {editing ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                {editing ? 'Annuler' : 'Modifier'}
              </Button>
            </div>

            {/* Edit form */}
            {editing && (
              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-3 mb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="h-10"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button size="sm" className="rounded-full gap-1.5" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-3.5 w-3.5" />}
                  Enregistrer
                </Button>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm mb-4">{success}</div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: Mail, label: 'Email', value: profile?.email ?? user?.email ?? '—' },
                { icon: Calendar, label: 'Membre depuis', value: memberSince },
                isAdmin
                  ? { icon: Shield, label: 'Rôle', value: 'Administrateur — accès illimité' }
                  : { icon: Shield, label: 'Plan', value: `${planMeta.label} — ${planMeta.desc}` },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-sm font-medium truncate">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── STATS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: TrendingUp, label: 'Analyses', value: '—', color: 'text-primary' },
            { icon: GitCompare, label: 'Comparaisons', value: '—', color: 'text-blue-500' },
            { icon: MessageSquare, label: 'Négociations', value: '—', color: 'text-purple-500' },
            { icon: Star, label: 'Score moyen', value: '—/100', color: 'text-yellow-500' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className={`text-2xl font-bold font-serif ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── ACTIONS ── */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-2.5">
            <Button asChild variant="outline" className="flex-1 rounded-full gap-2">
              <Link to="/app/settings">
                <User className="h-4 w-4" />
                Paramètres du compte
              </Link>
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-2 hover:border-destructive/50 hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
