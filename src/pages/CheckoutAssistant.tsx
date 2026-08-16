import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Loader2, Smartphone, CreditCard,
  AlertCircle, ShieldCheck, Zap, Clock, Lock, Star, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { getAssistantPlans, createTransaction, getExchangeRates, updateTransaction, activateAssistantSubscription } from '@/lib/db'
import { convertFromUsd, DEFAULT_RATE_FALLBACK, type Currency } from '@/lib/currency'
import { FedaPayProvider } from '@/lib/payment/providers/FedaPay'
import { StripeProvider } from '@/lib/payment/providers/Stripe'
import type { PaymentGatewayInterface, ProviderName } from '@/lib/payment/PaymentGatewayInterface'
import type { AssistantPlan } from '@/lib/supabase'
import paymentMethods from '@/lib/payment/config/payment_methods.json'
import { toast } from 'sonner'

const VISIBLE_STEPS = ['plan', 'country', 'method', 'phone', 'confirm'] as const
type VisibleStep = typeof VISIBLE_STEPS[number]

const VISIBLE_LABELS: Record<VisibleStep, string> = {
  plan: 'Formule',
  country: 'Pays',
  method: 'Paiement',
  phone: 'Téléphone',
  confirm: 'Confirmation',
}

const TRUST_ITEMS = [
  { icon: Lock, label: 'Paiement 100% sécurisé' },
  { icon: Zap, label: 'Activation instantanée' },
  { icon: ShieldCheck, label: 'Mobile Money africain' },
  { icon: Clock, label: 'Support 24h/7j' },
]

type Country = keyof typeof paymentMethods
type Step = 'plan' | 'country' | 'method' | 'phone' | 'confirm' | 'waiting' | 'done'
const STEPS: Step[] = ['plan', 'country', 'method', 'phone', 'confirm', 'waiting', 'done']

const COUNTRY_LIST = Object.entries(paymentMethods as Record<string, {
  label: string; flag: string; currency: string; country_code: string
  calling_code: string; methods: { id: string; name: string; provider: string; color: string; active: boolean }[]
}>)

function getPaymentProvider(provider: string | undefined): PaymentGatewayInterface {
  const activeProvider = (provider ?? 'fedapay') as ProviderName
  if (activeProvider === 'stripe') return new StripeProvider()
  return new FedaPayProvider()
}

export default function CheckoutAssistantPage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialPlan = searchParams.get('plan') ?? ''

  const [step, setStep] = useState<Step>('plan')
  const [plans, setPlans] = useState<AssistantPlan[]>([])
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATE_FALLBACK)
  const [selectedPlan, setSelectedPlan] = useState<AssistantPlan | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<Country | ''>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [gatewayTransactionId, setGatewayTransactionId] = useState<string | null>(null)
  const [ussdCode, setUssdCode] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [pollingCount, setPollingCount] = useState(0)
  const [paymentStartedAt, setPaymentStartedAt] = useState<number | null>(null)

  const POLLING_INTERVAL_MS = 5000
  const POLLING_TIMEOUT_MS = 180000

  useEffect(() => {
    if (!user) { navigate('/login?next=/checkout-assistant'); return }
    Promise.all([getAssistantPlans(), getExchangeRates()])
      .then(([p, r]) => { setPlans(p); setRates(r) })
      .catch(() => toast.error('Erreur de chargement'))
  }, [user, navigate])

  useEffect(() => {
    if (plans.length && initialPlan) {
      const found = plans.find(p => p.name === initialPlan)
      if (found) { setSelectedPlan(found); setStep('country') }
    }
  }, [plans, initialPlan])

  const countryData = selectedCountry
    ? (paymentMethods as Record<string, typeof paymentMethods.benin>)[selectedCountry]
    : null
  const methodData = countryData?.methods.find(m => m.id === selectedMethod) ?? null

  useEffect(() => {
    if (step !== 'waiting' || !transactionId || !gatewayTransactionId || !paymentStartedAt) return

    const syncTransactionStatus = async (nextStatus: 'success' | 'failed' | 'pending', payload?: unknown) => {
      try {
        await updateTransaction(transactionId, {
          status: nextStatus,
          webhook_received_at: new Date().toISOString(),
          webhook_payload: payload && typeof payload === 'object' ? payload as Record<string, unknown> : null,
        })
      } catch {
        // non-blocking sync failure
      }
    }

    const interval = setInterval(async () => {
      const elapsed = Date.now() - paymentStartedAt
      if (elapsed >= POLLING_TIMEOUT_MS) {
        clearInterval(interval)
        await syncTransactionStatus('failed', { reason: 'polling_timeout' })
        toast.error('Délai dépassé. Vérifiez votre paiement puis réessayez.')
        setStep('confirm')
        return
      }

      try {
        const provider = getPaymentProvider(methodData?.provider)
        const status = await provider.checkPaymentStatus(gatewayTransactionId)

        if (status.status === 'success') {
          clearInterval(interval)
          await syncTransactionStatus('success', status.rawResponse)
          try {
            await activateAssistantSubscription(transactionId)
          } catch (err) {
            console.error('activateAssistantSubscription failed', err)
            toast.error("Paiement confirmé, mais l'activation a échoué — contactez le support.")
          }
          await refreshProfile()
          setStep('done')
          return
        }

        if (status.status === 'failed' || status.status === 'refunded') {
          clearInterval(interval)
          await syncTransactionStatus('failed', status.rawResponse)
          toast.error('Paiement échoué. Veuillez réessayer.')
          setStep('confirm')
          return
        }

        await syncTransactionStatus('pending', status.rawResponse)
      } catch {
        // retry on next tick
      }

      setPollingCount(c => c + 1)
    }, POLLING_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [step, transactionId, gatewayTransactionId, methodData?.provider, refreshProfile, paymentStartedAt])

  function localPrice(usd: number): string {
    const currency = (countryData?.currency ?? 'XOF') as Currency
    // Plans already store an XOF price directly (avoids an extra USD->XOF
    // conversion drifting from the number shown on the pricing page).
    if (currency === 'XOF' && selectedPlan) return `${selectedPlan.price_xof.toLocaleString('fr-FR')} FCFA`
    const amount = convertFromUsd(usd, currency, rates)
    if (currency === 'USD') return `$${amount.toFixed(2)}`
    if (currency === 'EUR') return `${amount.toFixed(2)} €`
    return `${amount.toLocaleString('fr-FR')} FCFA`
  }

  async function handleConfirmPayment() {
    if (!selectedCountry || !selectedMethod || !phone || !user || !selectedPlan) return
    setProcessing(true)
    try {
      const provider = getPaymentProvider(methodData?.provider)
      const currency = (countryData?.currency ?? 'XOF') as Currency
      const localAmount = currency === 'XOF'
        ? selectedPlan.price_xof
        : convertFromUsd(selectedPlan.price_usd, currency, rates)

      const result = await provider.initiatePayment({
        amount: localAmount,
        currency,
        phone,
        countryCode: countryData?.country_code ?? '',
        method: selectedMethod,
        description: `BizKey WhatsApp Assistant — ${selectedPlan.display_name}`,
        metadata: { user_id: user.id, assistant_plan_id: selectedPlan.id },
      })

      if (!result.success) throw new Error(result.message ?? 'Échec du paiement')

      const tx = await createTransaction({
        user_id: user.id,
        plan_id: null,
        quote_request_id: null,
        assistant_plan_id: selectedPlan.id,
        amount_local: localAmount,
        currency,
        amount_usd: selectedPlan.price_usd,
        payment_method: selectedMethod,
        country_code: countryData?.country_code ?? '',
        phone_number: phone,
        gateway: methodData?.provider ?? 'fedapay',
        gateway_transaction_id: result.transactionId,
        status: 'pending',
        webhook_received_at: null,
        webhook_payload: null,
      })

      setTransactionId(tx.id)
      setGatewayTransactionId(result.transactionId ?? tx.id)
      setPollingCount(0)
      setPaymentStartedAt(Date.now())
      if (result.ussdCode) setUssdCode(result.ussdCode)
      if (result.paymentUrl) window.open(result.paymentUrl, '_blank', 'noopener,noreferrer')
      setStep('waiting')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de paiement')
    } finally {
      setProcessing(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const visibleStepIndex = VISIBLE_STEPS.indexOf(step as VisibleStep)
  const canGoBack = stepIndex > 0 && step !== 'waiting' && step !== 'done'
  function goBack() { setStep(STEPS[stepIndex - 1]) }
  const isFullscreen = step === 'waiting' || step === 'done'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link to="/pricing" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Tarification</span>
        </Link>
        <Logo variant="lockup" size="sm" />
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-green-500" />
            Paiement sécurisé
          </div>
          <ModeToggle />
        </div>
      </header>

      {!isFullscreen && (
        <div className="border-b border-border bg-card/40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              {VISIBLE_STEPS.map((s, i) => {
                const isCompleted = visibleStepIndex > i
                const isCurrent = visibleStepIndex === i
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted ? 'bg-green-500 text-white shadow-sm shadow-green-500/30'
                          : isCurrent ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/15'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`hidden sm:block text-xs font-medium transition-colors ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {VISIBLE_LABELS[s]}
                      </span>
                    </div>
                    {i < VISIBLE_STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-2 transition-colors ${isCompleted ? 'bg-green-500/50' : 'bg-muted'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isFullscreen ? (
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          {step === 'waiting' && (
            <div className="text-center space-y-8 max-w-sm w-full">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                <div className="relative h-24 w-24 rounded-full bg-primary/15 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-serif">En attente de paiement</h2>
                <p className="text-muted-foreground text-sm">
                  Confirmez le paiement sur votre téléphone via <strong className="text-foreground">{methodData?.name}</strong>.
                  Cette page se met à jour automatiquement.
                </p>
              </div>
              {ussdCode && (
                <Card className="border-2 border-primary/30 bg-primary/5">
                  <CardContent className="pt-5 pb-5 text-center space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Code USSD à composer</p>
                    <p className="font-mono text-2xl font-bold text-primary tracking-wider">{ussdCode}</p>
                  </CardContent>
                </Card>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  Vérification en cours{pollingCount > 0 ? ` (${pollingCount})` : '…'}
                </div>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setPaymentStartedAt(null); setPollingCount(0); setStep('confirm') }}>
                  Annuler / Réessayer
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && selectedPlan && (
            <div className="text-center space-y-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-500">
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 rounded-full bg-green-500/20" />
                <div className="relative h-24 w-24 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
                  <Check className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-widest">Abonnement activé</p>
                <h2 className="text-2xl font-bold font-serif">BizKey WhatsApp Assistant est prêt !</h2>
                <p className="text-muted-foreground text-sm">
                  Votre formule <strong className="text-foreground">{selectedPlan.display_name}</strong> est maintenant active.
                </p>
              </div>
              <Card className="border-2 border-primary/20 bg-primary/5">
                <CardContent className="pt-5 pb-5 space-y-2 text-left">
                  {selectedPlan.features.map(f => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="space-y-3">
                <Button className="w-full rounded-full shadow-lg shadow-primary/20" onClick={() => navigate('/app/assistant')}>
                  Accéder à l'assistant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span>Un reçu a été envoyé à votre adresse email</span>
              </div>
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 space-y-5 min-w-0">
              {step === 'plan' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Choisissez votre formule</h2>
                    <p className="text-muted-foreground text-sm mt-1">BizKey WhatsApp Assistant — abonnement mensuel.</p>
                  </div>
                  <div className="space-y-3">
                    {plans.map(plan => (
                      <Card
                        key={plan.id}
                        className={`cursor-pointer border-2 transition-all hover:shadow-lg group ${
                          plan.is_popular ? 'border-primary/50 shadow-md shadow-primary/10' : 'border-border hover:border-primary/40'
                        }`}
                        onClick={() => { setSelectedPlan(plan); setStep('country') }}
                      >
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base">{plan.display_name}</span>
                                {plan.is_popular && (
                                  <Badge className="text-xs rounded-full bg-primary/15 text-primary border-primary/25 border">⭐ Populaire</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {plan.max_numbers} numéro{plan.max_numbers > 1 ? 's' : ''} · {plan.max_conversations_per_month.toLocaleString('fr-FR')} conversations/mois
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-xl">${plan.price_usd}</p>
                              <p className="text-xs text-muted-foreground">/mois</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => navigate('/pricing')}>
                    Voir la description détaillée des plans
                  </Button>
                </div>
              )}

              {step === 'country' && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Votre pays</h2>
                    <p className="text-muted-foreground text-sm mt-1">Sélectionnez votre pays pour voir les méthodes de paiement disponibles.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {COUNTRY_LIST.map(([key, info]) => (
                      <Card
                        key={key}
                        className={`cursor-pointer border-2 transition-all hover:shadow-md hover:border-primary/50 ${
                          selectedCountry === key ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border'
                        }`}
                        onClick={() => { setSelectedCountry(key as Country); setSelectedMethod(''); setStep('method') }}
                      >
                        <CardContent className="py-4 flex items-center gap-3">
                          <span className="text-3xl">{info.flag}</span>
                          <div>
                            <div className="font-semibold text-sm">{info.label}</div>
                            <div className="text-xs text-muted-foreground">{info.currency}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {step === 'method' && countryData && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Moyen de paiement</h2>
                    <p className="text-muted-foreground text-sm mt-1">Paiement disponible pour {countryData.flag} {countryData.label}.</p>
                  </div>
                  <div className="space-y-3">
                    {countryData.methods.map(m => (
                      <Card
                        key={m.id}
                        className={`border-2 transition-all ${
                          !m.active ? 'opacity-45 cursor-not-allowed border-border'
                            : `cursor-pointer hover:shadow-md ${selectedMethod === m.id ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/50'}`
                        }`}
                        onClick={() => { if (!m.active) return; setSelectedMethod(m.id); setStep('phone') }}
                      >
                        <CardContent className="py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                              <Smartphone className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{m.name}</div>
                              <div className="text-xs text-muted-foreground">{m.provider}</div>
                            </div>
                          </div>
                          {!m.active ? (
                            <Badge variant="secondary" className="text-xs rounded-full">Bientôt</Badge>
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-primary flex items-center justify-center">
                              {selectedMethod === m.id && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    <Card className="cursor-not-allowed border-2 border-border opacity-40">
                      <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">Carte bancaire (Stripe)</div>
                            <div className="text-xs text-muted-foreground">Visa, Mastercard</div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs rounded-full">Bientôt</Badge>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {step === 'phone' && countryData && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Votre numéro Mobile Money</h2>
                    <p className="text-muted-foreground text-sm mt-1">Entrez le numéro lié à votre compte {methodData?.name}.</p>
                  </div>
                  <Card className="border-2 border-border">
                    <CardContent className="pt-6 space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold">Numéro de téléphone</Label>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2 border rounded-xl px-4 py-3 text-sm bg-secondary min-w-[100px] font-medium">
                            <span className="text-lg">{countryData.flag}</span>
                            <span className="text-muted-foreground">{countryData.calling_code}</span>
                          </div>
                          <Input
                            id="phone"
                            placeholder="XX XX XX XX"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                            maxLength={12}
                            className="flex-1 h-12 rounded-xl text-base font-mono tracking-wider"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                          Votre numéro est chiffré et jamais partagé
                        </p>
                      </div>
                      <Button className="w-full h-12 rounded-xl shadow-md shadow-primary/20" disabled={phone.length < 8} onClick={() => setStep('confirm')}>
                        Continuer vers la confirmation
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {step === 'confirm' && selectedPlan && countryData && methodData && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-400">
                  <div>
                    <h2 className="text-2xl font-bold font-serif">Récapitulatif</h2>
                    <p className="text-muted-foreground text-sm mt-1">Vérifiez vos informations avant de confirmer.</p>
                  </div>
                  <Card className="border-2 border-border">
                    <CardContent className="pt-5 space-y-4">
                      <div className="divide-y divide-border space-y-1">
                        {[
                          { label: 'Formule', value: selectedPlan.display_name },
                          { label: 'Inclus', value: `${selectedPlan.max_numbers} numéro${selectedPlan.max_numbers > 1 ? 's' : ''} · ${selectedPlan.max_conversations_per_month.toLocaleString('fr-FR')} conv./mois` },
                          { label: 'Pays', value: `${countryData.flag} ${countryData.label}` },
                          { label: 'Méthode', value: methodData.name },
                          { label: 'Téléphone', value: `${countryData.calling_code} ${phone}` },
                        ].map(row => (
                          <div key={row.label} className="flex justify-between text-sm py-2">
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold text-base pt-3">
                          <span>Total à payer</span>
                          <span className="text-primary">{localPrice(selectedPlan.price_usd)}/mois</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="py-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                        Vous allez recevoir une demande de confirmation sur votre téléphone.{' '}
                        Suivez les instructions USSD de <strong>{methodData.name}</strong>.
                      </p>
                    </CardContent>
                  </Card>
                  <Button className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 text-base" onClick={handleConfirmPayment} disabled={processing}>
                    {processing
                      ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Traitement en cours…</>
                      : <><Lock className="h-4 w-4 mr-2" />Confirmer le paiement — {localPrice(selectedPlan.price_usd)}/mois</>}
                  </Button>
                </div>
              )}

              {canGoBack && (
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              )}
            </div>

            <div className="lg:w-72 shrink-0 space-y-4 lg:sticky lg:top-[120px]">
              <Card className="border-2 border-border bg-card">
                <CardContent className="pt-5 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-primary" /> Résumé de commande
                  </p>
                  {selectedPlan ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">{selectedPlan.display_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Assistant WhatsApp</p>
                        </div>
                        <p className="font-black text-lg shrink-0">${selectedPlan.price_usd}</p>
                      </div>
                      {selectedCountry && countryData && (
                        <div className="pt-3 border-t border-border space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pays</span>
                            <span>{countryData.flag} {countryData.label}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Total</span>
                            <span className="text-primary">{localPrice(selectedPlan.price_usd)}/mois</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sélectionnez une formule</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardContent className="py-4 space-y-3">
                  {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-sm">
                      <div className="h-7 w-7 rounded-lg bg-green-50 dark:bg-green-950/40 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-muted-foreground text-xs">{label}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
