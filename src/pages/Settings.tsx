import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell, Lock, Palette, Globe, Shield,
  Trash2, Save, Eye, EyeOff, AlertTriangle, Check,
  Sun, Moon, Monitor, Crown, ArrowUpRight, CalendarClock, Wallet, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/mode-toggle'
import { TwoFactorSettings } from '@/components/TwoFactorSettings'
import { useAuth } from '@/contexts/AuthContext'
import { getUserSubscription, getAllPlans, getAllAssistantPlans } from '@/lib/db'
import { mapAuthError } from '@/lib/authErrors'
import type { Plan, Subscription, AssistantPlan, AssistantClientStatus } from '@/lib/supabase'

import { supabase } from '@/lib/supabase'

type Section = 'subscription' | 'notifications' | 'security' | 'appearance' | 'language' | 'danger'

function SectionButton({ id, current, icon: Icon, label, onClick }: {
  id: Section; current: Section; icon: React.ElementType; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
        current === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  )
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  mtn_money: 'MTN Mobile Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  stripe: 'Carte bancaire',
}

const SUBSCRIPTION_STATUS_META: Record<Subscription['status'], { label: string; color: string }> = {
  active: { label: 'Actif', color: 'text-primary border-primary/30' },
  pending: { label: 'En attente', color: 'text-amber-600 border-amber-500/30' },
  expired: { label: 'Expiré', color: 'text-muted-foreground border-border' },
  cancelled: { label: 'Résilié', color: 'text-destructive border-destructive/30' },
}

const ASSISTANT_STATUS_META: Record<AssistantClientStatus, { label: string; color: string }> = {
  trial: { label: 'Essai', color: 'text-blue-600 border-blue-500/30' },
  active: { label: 'Actif', color: 'text-primary border-primary/30' },
  suspended: { label: 'Suspendu', color: 'text-amber-600 border-amber-500/30' },
  cancelled: { label: 'Résilié', color: 'text-destructive border-destructive/30' },
  expired: { label: 'Expiré', color: 'text-muted-foreground border-border' },
}

export default function SettingsPage() {
  const { user, profile, assistantClient, signOut } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('subscription')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [assistantPlans, setAssistantPlans] = useState<AssistantPlan[]>([])
  const [loadingSub, setLoadingSub] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.allSettled([getUserSubscription(user.id), getAllPlans(), getAllAssistantPlans()]).then(([sub, p, ap]) => {
      if (sub.status === 'fulfilled') setSubscription(sub.value)
      if (p.status === 'fulfilled') setPlans(p.value)
      if (ap.status === 'fulfilled') setAssistantPlans(ap.value)
    }).finally(() => setLoadingSub(false))
  }, [user])

  // Notification prefs
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifAnalysis, setNotifAnalysis] = useState(true)
  const [notifNewsletter, setNotifNewsletter] = useState(false)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')
    if (newPassword !== confirmPassword) { setPwError('Les mots de passe ne correspondent pas'); return }
    if (newPassword.length < 8) { setPwError('Minimum 8 caractères'); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPwSuccess('Mot de passe mis à jour avec succès')
      setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPwError(mapAuthError(err))
    } finally {
      setSavingPw(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'SUPPRIMER') return
    setDeleting(true)
    // In production: call a Supabase edge function that deletes the user
    // For now we sign out
    await signOut()
    navigate('/')
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold">Paramètres</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez votre compte et vos préférences</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar nav */}
          <aside className="lg:w-52 flex-shrink-0">
            <Card>
              <CardContent className="p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto">
                <SectionButton id="subscription" current={section} icon={Crown} label="Abonnement" onClick={() => setSection('subscription')} />
                <SectionButton id="notifications" current={section} icon={Bell} label="Notifications" onClick={() => setSection('notifications')} />
                <SectionButton id="security" current={section} icon={Lock} label="Sécurité" onClick={() => setSection('security')} />
                <SectionButton id="appearance" current={section} icon={Palette} label="Apparence" onClick={() => setSection('appearance')} />
                <SectionButton id="language" current={section} icon={Globe} label="Langue & région" onClick={() => setSection('language')} />
                <Separator className="my-1 hidden lg:block" />
                <SectionButton id="danger" current={section} icon={Trash2} label="Zone de danger" onClick={() => setSection('danger')} />
              </CardContent>
            </Card>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* SUBSCRIPTION */}
            {section === 'subscription' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" />
                    Abonnement BizKey Sourcing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingSub ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                      Chargement...
                    </div>
                  ) : profile?.is_admin ? (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                      Compte administrateur — accès illimité, non soumis à un abonnement.
                    </div>
                  ) : subscription ? (
                    (() => {
                      const plan = plans.find(p => p.id === subscription.plan_id)
                      const statusMeta = SUBSCRIPTION_STATUS_META[subscription.status]
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <div>
                              <p className="text-xs text-muted-foreground">Formule actuelle</p>
                              <p className="text-lg font-bold mt-0.5">{plan?.display_name ?? 'Formule inconnue'}</p>
                            </div>
                            <Badge variant="outline" className={`text-xs shrink-0 ${statusMeta.color}`}>{statusMeta.label}</Badge>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                              <p className="text-xs text-muted-foreground">Crédits Basic restants</p>
                              <p className="text-base font-semibold mt-0.5">{subscription.basic_credits_remaining}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                              <p className="text-xs text-muted-foreground">Crédits Advanced restants</p>
                              <p className="text-base font-semibold mt-0.5">{subscription.advanced_credits_remaining}</p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-b border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Moyen de paiement</span>
                              <span className="font-medium">
                                {subscription.payment_method ? (PAYMENT_METHOD_LABELS[subscription.payment_method] ?? subscription.payment_method) : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Débuté le</span>
                              <span className="font-medium">{new Date(subscription.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Expire le</span>
                              <span className="font-medium">
                                {subscription.expires_at
                                  ? new Date(subscription.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                                  : 'Sans expiration'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <span className="text-muted-foreground">Renouvellement automatique</span>
                              <span className="font-medium">{subscription.auto_renew ? 'Activé' : 'Désactivé'}</span>
                            </div>
                          </div>

                          <Button asChild variant="outline" className="w-full rounded-full gap-1.5">
                            <Link to="/pricing"><ArrowUpRight className="h-4 w-4" /> Changer de formule</Link>
                          </Button>
                        </>
                      )
                    })()
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-secondary/40 border border-border text-sm">
                        <p className="font-medium">Plan gratuit</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {(profile?.basic_credits_remaining ?? profile?.credits_remaining ?? 0)} crédits Basic restants · aucun abonnement actif
                        </p>
                      </div>
                      <Button asChild className="w-full rounded-full gap-1.5">
                        <Link to="/pricing"><ArrowUpRight className="h-4 w-4" /> Voir les formules</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SUBSCRIPTION — Assistant */}
            {section === 'subscription' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    Abonnement BizKey WhatsApp Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingSub ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                      Chargement...
                    </div>
                  ) : profile?.is_admin ? (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                      Compte administrateur — accès illimité, non soumis à un abonnement.
                    </div>
                  ) : assistantClient ? (
                    (() => {
                      const plan = assistantPlans.find(p => p.id === assistantClient.plan_id)
                      const statusMeta = ASSISTANT_STATUS_META[assistantClient.status]
                      return (
                        <>
                          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            <div>
                              <p className="text-xs text-muted-foreground">Formule actuelle</p>
                              <p className="text-lg font-bold mt-0.5">{plan?.display_name ?? 'Formule inconnue'}</p>
                            </div>
                            <Badge variant="outline" className={`text-xs shrink-0 ${statusMeta.color}`}>{statusMeta.label}</Badge>
                          </div>
                          {plan && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                                <p className="text-xs text-muted-foreground">Numéro(s) WhatsApp</p>
                                <p className="text-base font-semibold mt-0.5">{plan.max_numbers}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                                <p className="text-xs text-muted-foreground">Conversations / mois</p>
                                <p className="text-base font-semibold mt-0.5">{plan.max_conversations_per_month.toLocaleString('fr-FR')}</p>
                              </div>
                            </div>
                          )}
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-b border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Client depuis</span>
                              <span className="font-medium">{new Date(assistantClient.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border">
                              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Période en cours — débutée le</span>
                              <span className="font-medium">
                                {assistantClient.current_period_start
                                  ? new Date(assistantClient.current_period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <span className="text-muted-foreground flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Période en cours — expire le</span>
                              <span className="font-medium">
                                {assistantClient.current_period_end
                                  ? new Date(assistantClient.current_period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                                  : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" className="flex-1 rounded-full gap-1.5">
                              <Link to="/app/assistant/billing">Voir la facturation</Link>
                            </Button>
                            <Button asChild variant="outline" className="flex-1 rounded-full gap-1.5">
                              <Link to="/pricing?product=assistant"><ArrowUpRight className="h-4 w-4" /> Changer de formule</Link>
                            </Button>
                          </div>
                        </>
                      )
                    })()
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 rounded-xl bg-secondary/40 border border-border text-sm">
                        <p className="font-medium">Aucun abonnement actif</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Connectez votre numéro WhatsApp Business à un assistant automatisé.
                        </p>
                      </div>
                      <Button asChild className="w-full rounded-full gap-1.5">
                        <Link to="/pricing?product=assistant"><ArrowUpRight className="h-4 w-4" /> Voir les formules</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* NOTIFICATIONS */}
            {section === 'notifications' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: 'email', label: 'Notifications par email', desc: 'Recevez vos alertes importantes par email', value: notifEmail, setter: setNotifEmail },
                    { id: 'analysis', label: 'Fin d\'analyse', desc: 'Notification quand une analyse est complète', value: notifAnalysis, setter: setNotifAnalysis },
                    { id: 'newsletter', label: 'Newsletter mensuelle', desc: 'Conseils sourcing et actualités import Chine-Afrique', value: notifNewsletter, setter: setNotifNewsletter },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border">
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                      </div>
                      <Switch checked={item.value} onCheckedChange={item.setter} />
                    </div>
                  ))}
                  <Button size="sm" className="rounded-full gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    Enregistrer les préférences
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* SECURITY */}
            {section === 'security' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    Sécurité
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border text-sm flex items-start gap-2.5">
                    <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Compte connecté</div>
                      <div className="text-muted-foreground text-xs">{user?.email}</div>
                    </div>
                  </div>
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <h3 className="text-sm font-semibold">Changer le mot de passe</h3>
                    {[
                      { id: 'newPw', label: 'Nouveau mot de passe', value: newPassword, setter: setNewPassword },
                      { id: 'confirmPw', label: 'Confirmer le mot de passe', value: confirmPassword, setter: setConfirmPassword },
                    ].map((field) => (
                      <div key={field.id} className="space-y-1.5">
                        <Label htmlFor={field.id}>{field.label}</Label>
                        <div className="relative">
                          <Input
                            id={field.id}
                            type={showPw ? 'text' : 'password'}
                            value={field.value}
                            onChange={(e) => field.setter(e.target.value)}
                            className="pr-10 h-10"
                            placeholder="••••••••"
                            minLength={8}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw(!showPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                    {pwSuccess && (
                      <p className="text-xs text-primary flex items-center gap-1.5">
                        <Check className="h-3 w-3" />{pwSuccess}
                      </p>
                    )}
                    <Button type="submit" size="sm" className="rounded-full gap-1.5" disabled={savingPw}>
                      {savingPw ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <Lock className="h-3.5 w-3.5" />}
                      Mettre à jour
                    </Button>
                  </form>

                </CardContent>
              </Card>
            )}

            {section === 'security' && <TwoFactorSettings />}

            {/* APPEARANCE */}
            {section === 'appearance' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Apparence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Thème</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Sun, label: 'Clair', value: 'light' },
                        { icon: Moon, label: 'Sombre', value: 'dark' },
                        { icon: Monitor, label: 'Système', value: 'system' },
                      ].map((theme) => (
                        <div key={theme.value} className="p-3 rounded-xl border-2 border-border bg-secondary/30 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/40 transition">
                          <theme.icon className="h-5 w-5 text-muted-foreground" />
                          <span className="text-xs font-medium">{theme.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <ModeToggle />
                      <span>Utilisez le bouton ci-contre pour changer de thème</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* LANGUAGE */}
            {section === 'language' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Langue & région
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Langue de l'interface</Label>
                    <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="fr">🇫🇷 Français</option>
                      <option value="en" disabled>🇬🇧 English (bientôt)</option>
                      <option value="pt" disabled>🇧🇷 Português (bientôt)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Devise d'affichage</Label>
                    <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="USD">$ USD — Dollar américain</option>
                      <option value="XOF">XOF — Franc CFA UEMOA</option>
                      <option value="XAF">XAF — Franc CFA CEMAC</option>
                      <option value="EUR">€ EUR — Euro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pays d'activité principal</Label>
                    <select className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {['Bénin', 'Togo', 'Sénégal', 'Mali', "Côte d'Ivoire", 'Niger', 'Cameroun'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" className="rounded-full gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    Enregistrer
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* DANGER ZONE */}
            {section === 'danger' && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Zone de danger
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                    <h3 className="text-sm font-semibold text-destructive mb-1">Supprimer le compte</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      Cette action est irréversible. Toutes vos analyses, comparaisons et données seront définitivement supprimées.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="deleteConfirm" className="text-xs">
                        Tapez <strong>SUPPRIMER</strong> pour confirmer
                      </Label>
                      <Input
                        id="deleteConfirm"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="SUPPRIMER"
                        className="h-9 text-sm border-destructive/30 focus-visible:ring-destructive"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full gap-1.5"
                        disabled={deleteConfirm !== 'SUPPRIMER' || deleting}
                        onClick={handleDeleteAccount}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer définitivement
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
