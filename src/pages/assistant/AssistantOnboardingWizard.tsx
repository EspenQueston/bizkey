import { useState } from 'react'
import {
  ArrowRight, ArrowLeft, Check, Loader2, Building2, Bot, Smartphone,
  Users, HelpCircle, PartyPopper, UserPlus, ListChecks,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToneSelector } from '@/components/assistant/ToneSelector'
import { BusinessHoursEditor, defaultHours, normalizeHours, type BusinessHours } from '@/components/assistant/BusinessHoursEditor'
import { completeAssistantOnboarding, inviteAssistantClientMember, createWhatsAppKbArticle } from '@/lib/db'
import type { AssistantClient, AssistantTone } from '@/lib/supabase'
import paymentMethods from '@/lib/payment/config/payment_methods.json'
import { toast } from 'sonner'

const COUNTRY_LIST = Object.entries(paymentMethods as Record<string, { label: string; flag: string }>)

const SECTORS = [
  'Commerce & vente', 'Restauration', 'Services', 'Santé', 'Éducation',
  'Technologie', 'Artisanat', 'Transport & logistique', 'Autre',
]

const STEPS = ['company', 'assistant', 'whatsapp', 'team', 'faq'] as const
type Step = typeof STEPS[number] | 'done'

const STEP_LABELS: Record<typeof STEPS[number], string> = {
  company: 'Entreprise', assistant: 'Assistant', whatsapp: 'WhatsApp', team: 'Équipe', faq: 'FAQ',
}

export default function AssistantOnboardingWizard({ assistantClient, onDone }: {
  assistantClient: AssistantClient
  onDone: () => void
}) {
  const [step, setStep] = useState<Step>('company')
  const [saving, setSaving] = useState(false)

  const [companyName, setCompanyName] = useState(assistantClient.company_name)
  const [sector, setSector] = useState(assistantClient.sector ?? '')
  const [country, setCountry] = useState(assistantClient.country ?? '')
  const [phone, setPhone] = useState(assistantClient.contact_phone ?? '')

  const [tone, setTone] = useState<AssistantTone>(assistantClient.tone)
  const [hours, setHours] = useState<BusinessHours>(normalizeHours(assistantClient.business_hours) ?? defaultHours())

  const [requestedNumber, setRequestedNumber] = useState(assistantClient.requested_whatsapp_number ?? '')
  const numberAlreadyConnected = !!assistantClient.whatsapp_number_id

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager')
  const [inviting, setInviting] = useState(false)
  const [invitedCount, setInvitedCount] = useState(0)

  const [faqTitle, setFaqTitle] = useState('')
  const [faqAnswer, setFaqAnswer] = useState('')
  const [savingFaq, setSavingFaq] = useState(false)
  const [faqAddedCount, setFaqAddedCount] = useState(0)

  const stepIndex = step === 'done' ? STEPS.length : STEPS.indexOf(step)

  function goTo(s: Step) { setStep(s) }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await inviteAssistantClientMember(assistantClient.id, inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      setInvitedCount(c => c + 1)
      toast.success('Invitation envoyée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'invitation")
    } finally {
      setInviting(false)
    }
  }

  async function handleAddFaq() {
    if (!faqTitle.trim() || !faqAnswer.trim()) return
    setSavingFaq(true)
    try {
      await createWhatsAppKbArticle({
        title: faqTitle.trim(), keywords: [], answer: faqAnswer.trim(),
        is_active: true, client_id: assistantClient.id,
      })
      setFaqTitle(''); setFaqAnswer('')
      setFaqAddedCount(c => c + 1)
      toast.success('Question ajoutée à la FAQ')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'ajout")
    } finally {
      setSavingFaq(false)
    }
  }

  async function handleFinish() {
    setSaving(true)
    try {
      await completeAssistantOnboarding({
        companyName: companyName.trim() || assistantClient.company_name,
        sector: sector || undefined,
        country: country || undefined,
        contactPhone: phone.trim() || undefined,
        tone,
        businessHours: hours,
        requestedWhatsappNumber: numberAlreadyConnected ? undefined : (requestedNumber.trim() || undefined),
        finish: true,
      })
      setStep('done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        {step !== 'done' && (
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const isCompleted = stepIndex > i
              const isCurrent = stepIndex === i
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={`hidden sm:block text-[11px] font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>{STEP_LABELS[s]}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${isCompleted ? 'bg-green-500/50' : 'bg-muted'}`} />}
                </div>
              )
            })}
          </div>
        )}

        {step === 'company' && (
          <Card className="border-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold font-serif flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Parlez-nous de votre entreprise</h2>
                <p className="text-sm text-muted-foreground mt-1">Ces informations personnalisent votre espace BizKey.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nom de l'entreprise</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="h-11" placeholder="Ex: Boutique Aïcha" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Secteur d'activité</Label>
                  <select value={sector} onChange={e => setSector(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">Sélectionner…</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pays</Label>
                  <select value={country} onChange={e => setCountry(e.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">Sélectionner…</option>
                    {COUNTRY_LIST.map(([key, info]) => <option key={key} value={key}>{info.flag} {info.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone de contact (optionnel)</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-11 font-mono" placeholder="+229 XX XX XX XX" />
              </div>
              <Button className="w-full h-11 rounded-xl" disabled={!companyName.trim()} onClick={() => goTo('assistant')}>
                Continuer <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'assistant' && (
          <Card className="border-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CardContent className="pt-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold font-serif flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Configurez votre assistant</h2>
                <p className="text-sm text-muted-foreground mt-1">Vous pourrez toujours ajuster ces réglages plus tard.</p>
              </div>
              <div className="space-y-2">
                <Label>Ton des réponses</Label>
                <ToneSelector value={tone} onChange={setTone} />
              </div>
              <div className="space-y-2">
                <Label>Horaires d'ouverture</Label>
                <BusinessHoursEditor value={hours} onChange={setHours} />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => goTo('company')}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={() => goTo('whatsapp')}>
                  Continuer <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'whatsapp' && (
          <Card className="border-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold font-serif flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /> Numéro WhatsApp</h2>
                <p className="text-sm text-muted-foreground mt-1">Le numéro que vos clients contacteront.</p>
              </div>
              {numberAlreadyConnected ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
                  <Check className="h-5 w-5 text-primary shrink-0" /> Un numéro est déjà connecté à votre compte.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    Indiquez le numéro à connecter — notre équipe le vérifie et l'active sous 24h. Vous pouvez passer cette étape et le renseigner plus tard.
                  </div>
                  <div className="space-y-1.5">
                    <Label>Numéro à connecter</Label>
                    <Input value={requestedNumber} onChange={e => setRequestedNumber(e.target.value)} className="h-11 font-mono" placeholder="Ex: +229 XX XX XX XX" />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => goTo('assistant')}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={() => goTo('team')}>
                  Continuer <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'team' && (
          <Card className="border-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold font-serif flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Invitez votre équipe</h2>
                <p className="text-sm text-muted-foreground mt-1">Optionnel — la personne doit déjà avoir un compte BizKey.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" placeholder="email@exemple.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="h-10 flex-1" />
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'manager' | 'viewer')} className="h-10 rounded-lg border border-input bg-background px-2 text-xs">
                  <option value="manager">Responsable</option>
                  <option value="viewer">Lecture seule</option>
                </select>
                <Button size="sm" className="h-10 rounded-lg gap-1.5" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Inviter
                </Button>
              </div>
              {invitedCount > 0 && <p className="text-xs text-primary font-medium">{invitedCount} invitation{invitedCount > 1 ? 's' : ''} envoyée{invitedCount > 1 ? 's' : ''}.</p>}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => goTo('whatsapp')}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={() => goTo('faq')}>
                  {invitedCount > 0 ? 'Continuer' : 'Passer cette étape'} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'faq' && (
          <Card className="border-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold font-serif flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Ajoutez une première question fréquente</h2>
                <p className="text-sm text-muted-foreground mt-1">Optionnel — votre assistant s'en servira pour répondre automatiquement.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Question</Label>
                <Input value={faqTitle} onChange={e => setFaqTitle(e.target.value)} className="h-10" placeholder="Ex: Quels sont vos délais de livraison ?" />
              </div>
              <div className="space-y-1.5">
                <Label>Réponse</Label>
                <Textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={3} placeholder="La réponse que l'assistant enverra…" />
              </div>
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={handleAddFaq} disabled={savingFaq || !faqTitle.trim() || !faqAnswer.trim()}>
                {savingFaq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Ajouter à la FAQ
              </Button>
              {faqAddedCount > 0 && <p className="text-xs text-primary font-medium">{faqAddedCount} question{faqAddedCount > 1 ? 's' : ''} ajoutée{faqAddedCount > 1 ? 's' : ''}.</p>}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => goTo('team')}><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={handleFinish} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Terminer la configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500 py-8">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-green-500/20" />
              <div className="relative h-20 w-20 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
                <PartyPopper className="h-9 w-9 text-green-600" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold font-serif">Tout est prêt !</h2>
              <p className="text-muted-foreground text-sm">{companyName} est configuré. Vous pouvez ajuster ces réglages à tout moment depuis "Réglages".</p>
            </div>
            <Button className="rounded-full shadow-lg shadow-primary/20 px-8" onClick={onDone}>
              Accéder au tableau de bord <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
