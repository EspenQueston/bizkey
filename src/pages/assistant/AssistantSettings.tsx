import { useEffect, useState } from 'react'
import { Settings, Smartphone, Clock, Sparkles, Save, CheckCircle2, HelpCircle, Users, UserPlus, Trash2, Crown, Eye, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { ToneSelector } from '@/components/assistant/ToneSelector'
import { BusinessHoursEditor, defaultHours, normalizeHours, type BusinessHours } from '@/components/assistant/BusinessHoursEditor'
import { useAuth } from '@/contexts/AuthContext'
import {
  getWhatsAppNumbers, updateMyAssistantSettings,
  getAssistantClientMembers, inviteAssistantClientMember, updateAssistantClientMemberRole, removeAssistantClientMember,
} from '@/lib/db'
import type { AssistantTone, WhatsAppNumber, AssistantClientMember, AssistantMemberRole } from '@/lib/supabase'
import { toast } from 'sonner'

const ROLE_META: Record<AssistantMemberRole, { label: string; icon: typeof Crown; color: string }> = {
  owner:   { label: 'Propriétaire', icon: Crown, color: 'text-primary border-primary/30' },
  manager: { label: 'Responsable',  icon: Pencil, color: 'text-blue-600 border-blue-500/30' },
  viewer:  { label: 'Lecture seule', icon: Eye, color: 'text-muted-foreground border-border' },
}

export default function AssistantSettingsPage() {
  const { assistantClient, assistantRole, refreshProfile } = useAuth()
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tone, setTone] = useState<AssistantTone>('professional')
  const [hours, setHours] = useState<BusinessHours>(defaultHours())
  const [requestedNumber, setRequestedNumber] = useState('')

  const [members, setMembers] = useState<AssistantClientMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<AssistantClientMember | null>(null)

  const isOwner = assistantRole === 'owner'

  useEffect(() => {
    if (!assistantClient) { setLoading(false); return }
    setTone(assistantClient.tone)
    setHours(normalizeHours(assistantClient.business_hours))
    setRequestedNumber(assistantClient.requested_whatsapp_number ?? '')
    getWhatsAppNumbers().then(setNumbers).catch(console.error).finally(() => setLoading(false))
  }, [assistantClient])

  function loadMembers() {
    if (!assistantClient) { setLoadingMembers(false); return }
    setLoadingMembers(true)
    getAssistantClientMembers(assistantClient.id).then(setMembers).catch(console.error).finally(() => setLoadingMembers(false))
  }

  useEffect(loadMembers, [assistantClient])

  async function handleInvite() {
    if (!assistantClient || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteAssistantClientMember(assistantClient.id, inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      loadMembers()
      toast.success('Membre ajouté à l’équipe')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'invitation")
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(member: AssistantClientMember, role: AssistantMemberRole) {
    try {
      await updateAssistantClientMemberRole(member.id, role)
      loadMembers()
      toast.success('Rôle mis à jour')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la mise à jour du rôle')
    }
  }

  async function handleRemove(member: AssistantClientMember) {
    setRemovingId(member.id)
    try {
      await removeAssistantClientMember(member.id)
      loadMembers()
      toast.success('Membre retiré')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec du retrait')
    } finally {
      setRemovingId(null)
      setConfirmRemove(null)
    }
  }

  const connectedNumber = numbers.find(n => n.id === assistantClient?.whatsapp_number_id)

  async function handleSave() {
    setSaving(true)
    try {
      await updateMyAssistantSettings({
        tone,
        businessHours: hours,
        requestedWhatsappNumber: requestedNumber.trim() || null,
      })
      await refreshProfile()
      toast.success('Réglages enregistrés')
    } catch (err) {
      console.error(err)
      toast.error('Échec de l’enregistrement')
    } finally {
      setSaving(false)
    }
  }

  if (!assistantClient) {
    return (
      <div className="p-6">
        <div className="py-16 text-center max-w-md mx-auto">
          <Settings className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun abonnement Assistant actif</p>
          <p className="text-xs text-muted-foreground mt-1">Souscrivez à une formule pour configurer votre assistant WhatsApp.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6 text-primary" /> Réglages de l'assistant</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{assistantClient.company_name}</p>
      </div>

      {/* WhatsApp number */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Numéro WhatsApp
          </p>
          {connectedNumber ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium font-mono">{connectedNumber.phone_number}</p>
                <p className="text-xs text-muted-foreground">{connectedNumber.label} — connecté et actif</p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px] text-primary border-primary/30">Actif</Badge>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                Aucun numéro connecté pour le moment. Indiquez le numéro à connecter — notre équipe le vérifie et l'active sous 24h.
              </div>
              <div className="space-y-1.5">
                <Label>Numéro à connecter</Label>
                <Input
                  placeholder="Ex: +229 XX XX XX XX"
                  value={requestedNumber}
                  onChange={e => setRequestedNumber(e.target.value)}
                  className="h-10 font-mono"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tone */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Ton de l'assistant
          </p>
          <ToneSelector value={tone} onChange={setTone} />
        </CardContent>
      </Card>

      {/* Business hours */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Horaires d'ouverture
          </p>
          <BusinessHoursEditor value={hours} onChange={setHours} />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="rounded-full gap-1.5">
        {saving ? <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <Save className="h-4 w-4" />}
        Enregistrer les réglages
      </Button>

      {/* Team */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Équipe
          </p>

          {loadingMembers ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(m => {
                const meta = ROLE_META[m.role]
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="h-9 w-9 rounded-full bg-secondary grid place-items-center shrink-0">
                      <meta.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.profile?.name ?? m.profile?.email ?? '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.profile?.email}</p>
                    </div>
                    {isOwner && m.role !== 'owner' ? (
                      <select
                        value={m.role}
                        onChange={e => handleRoleChange(m, e.target.value as AssistantMemberRole)}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                      >
                        <option value="manager">Responsable</option>
                        <option value="viewer">Lecture seule</option>
                      </select>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.color}`}>{meta.label}</Badge>
                    )}
                    {isOwner && m.role !== 'owner' && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg hover:text-destructive shrink-0"
                        onClick={() => setConfirmRemove(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isOwner && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
              <Input
                type="email"
                placeholder="email@exemple.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="h-9 flex-1"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'manager' | 'viewer')}
                className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
              >
                <option value="manager">Responsable</option>
                <option value="viewer">Lecture seule</option>
              </select>
              <Button size="sm" className="h-9 rounded-lg gap-1.5" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" /> : <UserPlus className="h-3.5 w-3.5" />}
                Inviter
              </Button>
            </div>
          )}
          {isOwner && (
            <p className="text-xs text-muted-foreground">
              La personne invitée doit déjà avoir un compte BizKey avec cette adresse e-mail.
            </p>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title="Retirer ce membre de l'équipe ?"
        description={confirmRemove ? `${confirmRemove.profile?.name ?? confirmRemove.profile?.email} perdra l'accès à cette entreprise BizKey Assistant.` : ''}
        loading={!!confirmRemove && removingId === confirmRemove.id}
        onConfirm={() => confirmRemove && handleRemove(confirmRemove)}
      />
    </div>
  )
}
