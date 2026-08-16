import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight, Check, Crown, Loader2, Package, ShieldCheck, Smartphone,
  Sparkles, Wallet, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { getExchangeRates, getPlans } from '@/lib/db'
import { formatCurrencyFromCny, DEFAULT_RATE_FALLBACK, type Currency } from '@/lib/currency'
import type { Plan } from '@/lib/supabase'

const ICON_MAP: Record<string, LucideIcon> = {
  Crown,
  Zap,
  Sparkles,
  Package,
}

const TRUST_ITEMS = [
  { icon: Smartphone, label: 'Orange Money, Wave, MTN et Moov selon le pays' },
  { icon: ShieldCheck, label: 'Paiement sécurisé via Edge Function Supabase' },
  { icon: Wallet, label: 'Crédits activés après confirmation du paiement' },
]

function getIcon(name?: string | null) {
  if (!name) return Sparkles
  return ICON_MAP[name] ?? Sparkles
}

function meta(plan: Plan) {
  return (plan.metadata ?? {}) as Record<string, unknown>
}

function features(plan: Plan) {
  return (meta(plan).features as string[] | undefined) ?? []
}

function isPopular(plan: Plan) {
  return (meta(plan).is_popular as boolean | undefined) ?? (plan.name === 'standard' || plan.name === 'payg_standard')
}

function description(plan: Plan) {
  return (meta(plan).description as string | undefined) ?? (
    plan.type === 'payg'
      ? 'Recharge ponctuelle de crédits sans abonnement.'
      : 'Formule mensuelle pour garder votre sourcing actif.'
  )
}

export default function DashboardPricingPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATE_FALLBACK)
  const [tab, setTab] = useState<'subscription' | 'payg'>('subscription')
  const [currency, setCurrency] = useState<Currency>('XOF')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([getPlans(), getExchangeRates()])
      .then(([plansResult, ratesResult]) => {
        if (cancelled) return
        if (plansResult.status === 'fulfilled') setPlans(plansResult.value)
        if (ratesResult.status === 'fulfilled') setRates(ratesResult.value)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const subscriptionPlans = useMemo(() => plans.filter((plan) => plan.type === 'subscription'), [plans])
  const paygPlans = useMemo(() => plans.filter((plan) => plan.type === 'payg'), [plans])
  const currentTier = profile?.is_admin ? 'pro' : (profile?.subscription_tier ?? 'free')
  const basicCredits = (profile?.basic_credits_remaining ?? profile?.credits_remaining ?? 0) + (profile?.payg_basic_credits ?? 0)
  const advancedCredits = (profile?.advanced_credits_remaining ?? 0) + (profile?.payg_advanced_credits ?? 0)

  function formatPrice(yuan: number) {
    return formatCurrencyFromCny(yuan, currency, rates)
  }

  function selectPlan(plan: Plan) {
    if (plan.price_yuan === 0) {
      navigate('/app/analyze')
      return
    }
    navigate(`/checkout?plan=${plan.name}`)
  }

  function renderPlan(plan: Plan) {
    const Icon = getIcon(meta(plan).icon_name as string | undefined)
    const popular = isPopular(plan)
    const planFeatures = features(plan)

    return (
      <Card
        key={plan.id}
        className={`relative border-2 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
          popular ? 'border-primary/60 shadow-primary/10' : 'border-border'
        }`}
      >
        {popular && (
          <div className="absolute -top-3 left-5">
            <Badge className="rounded-full bg-primary text-primary-foreground">Populaire</Badge>
          </div>
        )}
        <CardHeader className="pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{description(plan)}</p>
              </div>
            </div>
            <Badge variant="outline" className="rounded-full capitalize">
              {plan.type === 'payg' ? 'PAYG' : 'Mensuel'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div>
            <div className="text-3xl font-bold tracking-tight">
              {formatPrice(Number(plan.price_yuan))}
              {plan.type === 'subscription' && plan.price_yuan > 0 && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">/mois</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1">{plan.basic_credits} Basic</span>
              <span className="rounded-md bg-muted px-2 py-1">{plan.advanced_credits} Advanced</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {(planFeatures.length ? planFeatures : [
              'Analyse produit IA',
              'Score de confiance fournisseur',
              'Stratégie de négociation',
            ]).slice(0, 5).map((feature) => (
              <div key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button className="mt-auto rounded-full" onClick={() => selectPlan(plan)}>
            {plan.price_yuan === 0 ? 'Utiliser le plan gratuit' : 'Continuer au paiement'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          Chargement des formules...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3 rounded-full">
              <Crown className="h-3.5 w-3.5 text-primary" />
              Paiement & plans
            </Badge>
            <h1 className="font-serif text-2xl font-bold tracking-tight">Recharger ou upgrader</h1>
            <p className="text-sm text-muted-foreground">
              Choisissez une formule et continuez dans le même checkout Mobile Money sécurisé.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['XOF', 'CNY', 'USD', 'EUR'] as const).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={currency === item ? 'default' : 'outline'}
                onClick={() => setCurrency(item)}
              >
                {item === 'XOF' ? 'FCFA' : item}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-6 p-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Plan actuel</p>
                <p className="mt-1 text-xl font-bold capitalize">{currentTier === 'basic' ? 'Standard' : currentTier}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Crédits Basic</p>
                <p className="mt-1 text-xl font-bold">{profile?.is_admin ? 'Illimité' : basicCredits}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Crédits Advanced</p>
                <p className="mt-1 text-xl font-bold text-purple-600 dark:text-purple-400">
                  {profile?.is_admin ? 'Illimité' : advancedCredits}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="flex h-full flex-col justify-center gap-3 p-5">
              {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-background text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="flex flex-col gap-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="subscription">Abonnements</TabsTrigger>
            <TabsTrigger value="payg">Packs PAYG</TabsTrigger>
          </TabsList>

          {tab === 'subscription' && (
            <div className="grid gap-5 xl:grid-cols-3">
              {subscriptionPlans.map(renderPlan)}
            </div>
          )}

          {tab === 'payg' && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {paygPlans.map(renderPlan)}
            </div>
          )}
        </Tabs>
      </main>
    </div>
  )
}
