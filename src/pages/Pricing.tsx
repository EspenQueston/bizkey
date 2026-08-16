import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Sparkles, Package, Loader2, Bot, Search as SearchIcon, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { SiteNavbar } from '@/components/SiteNavbar'
import { ParticlesBackground } from '@/components/ParticlesBackground'
import { Footer } from '@/components/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { getPlans, getExchangeRates, getAssistantPlans } from '@/lib/db'
import { formatCurrencyFromCny, DEFAULT_RATE_FALLBACK, CURRENCY_LABELS, type Currency } from '@/lib/currency'
import type { Plan, AssistantPlan } from '@/lib/supabase'

type Product = 'sourcing' | 'assistant'

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Crown, Zap, Sparkles, Package,
}

function getIcon(name?: string | null) {
  if (!name) return null
  return ICON_MAP[name] ?? null
}

export default function PricingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [product, setProduct] = useState<Product>(searchParams.get('product') === 'assistant' ? 'assistant' : 'sourcing')
  const [tab, setTab] = useState<'subscription' | 'payg'>('subscription')
  const [displayCurrency, setDisplayCurrency] = useState<Currency>('CNY')
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATE_FALLBACK)
  const [plans, setPlans] = useState<Plan[]>([])
  const [assistantPlans, setAssistantPlans] = useState<AssistantPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getPlans(),
      getExchangeRates(),
      getAssistantPlans(),
    ]).then(([plansRes, ratesRes, assistantRes]) => {
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value)
      if (ratesRes.status === 'fulfilled') setRates(ratesRes.value)
      if (assistantRes.status === 'fulfilled') setAssistantPlans(assistantRes.value)
    }).finally(() => setLoading(false))
  }, [])

  const subscriptionPlans = plans.filter(p => p.type === 'subscription')
  const paygPacks = plans.filter(p => p.type === 'payg')

  function formatPrice(yuan: number): string {
    return formatCurrencyFromCny(yuan, displayCurrency, rates)
  }

  function handleSelectPlan(planName: string) {
    if (!user) { navigate('/login'); return }
    navigate(`/checkout?plan=${planName}`)
  }

  const meta = (plan: Plan) => (plan.metadata ?? {}) as Record<string, unknown>
  const features = (plan: Plan) => (meta(plan).features as string[] | undefined) ?? []
  const excludedFeatures = (plan: Plan) => (meta(plan).excluded_features as string[] | undefined) ?? []
  const isPopular = (plan: Plan) => (meta(plan).is_popular as boolean | undefined) ?? false
  const ctaLabel = (plan: Plan) => (meta(plan).cta_label as string | undefined) ?? 'Acheter'
  const ctaVariant = (plan: Plan) => (meta(plan).cta_variant as 'default' | 'outline' | undefined) ?? 'default'
  const description = (plan: Plan) => (meta(plan).description as string | undefined) ?? ''
  const tagColor = (plan: Plan) => (meta(plan).tag_color as string | undefined) ?? 'bg-secondary text-secondary-foreground'
  const iconName = (plan: Plan) => (meta(plan).icon_name as string | undefined) ?? null

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Chargement des formules…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteNavbar />

      {/* Hero — same animated particle treatment as the other public pages */}
      <section className="relative overflow-hidden pt-32 pb-14">
        <ParticlesBackground density={45} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <div className="relative max-w-6xl mx-auto w-full px-4 text-center space-y-3">
          <Badge variant="secondary" className="rounded-full mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary mr-1" />
            Tarifs transparents
          </Badge>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
            Choisissez votre <span className="text-primary">formule</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Abonnement mensuel ou recharge à la carte — payez uniquement ce que vous utilisez.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pb-12 space-y-10">

        {/* Product switcher — Pricing now covers both BizKey products */}
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 rounded-2xl bg-muted border border-border gap-1">
            <button
              onClick={() => setProduct('sourcing')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                product === 'sourcing' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <SearchIcon className="h-4 w-4" />
              BizKey Sourcing
            </button>
            <button
              onClick={() => setProduct('assistant')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                product === 'assistant' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot className="h-4 w-4" />
              BizKey WhatsApp Assistant
            </button>
          </div>
        </div>

        {/* Currency switcher — shared by both products so the Assistant tab's
            ¥ prices convert the same way Sourcing's already do. */}
        <div className="flex justify-center gap-2 flex-wrap">
          {(['CNY', 'XOF', 'USD', 'EUR'] as const).map(c => (
            <Button
              key={c}
              size="sm"
              variant={displayCurrency === c ? 'default' : 'outline'}
              onClick={() => setDisplayCurrency(c)}
              className="text-xs transition-all duration-200"
            >
              {CURRENCY_LABELS[c]}
            </Button>
          ))}
        </div>

        {product === 'sourcing' && (
        <>
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid w-full max-w-sm mx-auto grid-cols-2">
            <TabsTrigger value="subscription">Abonnement</TabsTrigger>
            <TabsTrigger value="payg">À la carte (PAYG)</TabsTrigger>
          </TabsList>

          {/* ── Subscription Plans ── */}
          {tab === 'subscription' && (
            <div className="mt-10 flex flex-col gap-6 items-center lg:flex-row lg:items-end lg:justify-center">
              {subscriptionPlans.map((plan, i) => {
                const Icon = getIcon(iconName(plan))
                const popular = isPopular(plan)
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                    whileHover={{ y: -6 }}
                    className="w-full max-w-sm"
                  >
                    <Card
                      className={`relative overflow-hidden border-2 transition-shadow duration-300 h-full ${
                        popular
                          ? 'border-primary bg-gradient-to-br from-[#0A1B33] to-[#162B49] text-white shadow-2xl shadow-[#0A1B33]/25'
                          : 'border-border hover:border-primary/30 hover:shadow-lg'
                      }`}
                    >
                      <CardHeader className="flex flex-row justify-between items-start pb-2 pt-6">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-5 w-5 text-primary" />}
                          <span className={`font-bold text-lg ${popular ? 'text-white' : ''}`}>{plan.display_name}</span>
                        </div>
                        {popular ? (
                          <motion.div
                            animate={{ backgroundPositionX: '-100%' }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
                            className="text-xs px-3 py-1 rounded-full border border-primary/30 bg-[linear-gradient(to_right,#F2C94C,#F7E7A7,#F2C94C)] [background-size:200%] text-transparent bg-clip-text font-semibold shrink-0"
                          >
                            ★ Populaire
                          </motion.div>
                        ) : plan.duration_days ? (
                          <Badge className="text-xs bg-secondary text-secondary-foreground shrink-0">{plan.duration_days}j</Badge>
                        ) : null}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold tracking-tight">{formatPrice(Number(plan.price_yuan))}</span>
                            {Number(plan.price_yuan) > 0 && (
                              <span className={`font-medium ${popular ? 'text-white/60' : 'text-muted-foreground'}`}>/mois</span>
                            )}
                          </div>
                          {description(plan) && (
                            <p className={`text-xs mt-1 ${popular ? 'text-white/70' : 'text-muted-foreground'}`}>{description(plan)}</p>
                          )}
                          <div className="flex gap-2 text-xs mt-2">
                            <span className={`rounded-full px-2.5 py-0.5 font-medium ${popular ? 'bg-white/10' : 'bg-muted'}`}>{plan.basic_credits} Basic</span>
                            <span className={`rounded-full px-2.5 py-0.5 font-medium ${popular ? 'bg-white/10' : 'bg-muted'}`}>{plan.advanced_credits} Advanced</span>
                          </div>
                        </div>

                        <Button
                          variant={popular ? 'default' : ctaVariant(plan)}
                          className="w-full transition-transform duration-200 hover:scale-[1.02]"
                          onClick={() => handleSelectPlan(plan.name)}
                        >
                          {ctaLabel(plan)}
                        </Button>

                        <ul className="flex flex-col gap-2.5 pt-1 text-sm">
                          {features(plan).map(f => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                              <span className={popular ? 'text-white/90' : ''}>{f}</span>
                            </li>
                          ))}
                          {excludedFeatures(plan).map(f => (
                            <li key={f} className={`flex items-start gap-2 line-through ${popular ? 'text-white/40' : 'text-muted-foreground'}`}>
                              <span className="h-4 w-4 mt-0.5 shrink-0 text-center">–</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* ── PAYG Packs ── */}
          {tab === 'payg' && (
            <div className="mt-8 space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Achetez des crédits une fois, sans abonnement. Ils n'expirent pas.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
                {paygPacks.map((pack, i) => {
                  const Icon = getIcon(iconName(pack))
                  const popular = isPopular(pack)
                  return (
                    <motion.div
                      key={pack.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
                      whileHover={{ y: -4 }}
                    >
                      <Card
                        className={`relative border cursor-pointer transition-shadow duration-300 h-full ${
                          popular ? 'border-primary/40 ring-1 ring-primary/20 shadow-md shadow-primary/10' : 'hover:shadow-md'
                        }`}
                        onClick={() => handleSelectPlan(pack.name)}
                      >
                        {popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5">Populaire</Badge>
                          </div>
                        )}
                        <CardContent className="pt-5 pb-4 space-y-3">
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4 text-primary" />}
                            <span className="font-semibold text-sm">{pack.display_name}</span>
                            <Badge className={`ml-auto text-xs ${tagColor(pack)}`}>PAYG</Badge>
                          </div>
                          <div className="text-2xl font-bold">{formatPrice(Number(pack.price_yuan))}</div>
                          <p className="text-xs text-muted-foreground">{description(pack)}</p>
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3 text-green-500" />
                              {pack.basic_credits} crédits Basic
                            </span>
                            {pack.advanced_credits > 0 && (
                              <span className="flex items-center gap-1">
                                <Check className="h-3 w-3 text-purple-500" />
                                {pack.advanced_credits} crédits Advanced
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full transition-transform duration-200 hover:scale-[1.02]"
                            onClick={e => { e.stopPropagation(); handleSelectPlan(pack.name) }}
                          >
                            Acheter
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </Tabs>

        {/* Credit types */}
        <div className="max-w-3xl mx-auto border rounded-xl p-6 bg-card space-y-4">
          <h2 className="font-semibold text-base">Types de crédits</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-xs font-medium">Basic</span>
                <span className="font-medium">Tâches rapides</span>
              </div>
              <p className="text-muted-foreground text-xs">Analyse standard, recherche d'image simple, messages de contact.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-xs font-medium">Advanced</span>
                <span className="font-medium">Analyse profonde</span>
              </div>
              <p className="text-muted-foreground text-xs">Rapport détaillé avec images, comparaison multi-sources, stratégie de négociation complète.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-3">
            Priorité de consommation : crédits d'abonnement d'abord, puis crédits PAYG.
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto space-y-4 pb-8">
          <h2 className="font-semibold text-xl text-center">Questions fréquentes sur les tarifs</h2>
          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: "Comment payer depuis l'Afrique ?",
                a: "Nous acceptons Orange Money, Wave, MTN Mobile Money, Moov Money et les virements bancaires locaux. Vous n'avez pas besoin d'une carte Visa ou d'un compte bancaire international. Le paiement se fait directement depuis votre téléphone, comme d'habitude.",
              },
              {
                q: "Quelle est la différence entre Basic et Advanced ?",
                a: "Les crédits Basic permettent des analyses rapides : recherche d'un fournisseur par image, rapport sommaire, messages de contact. Les crédits Advanced déclenchent une analyse approfondie avec rapport complet (images, comparaison multi-sources, calcul de rentabilité détaillé, stratégie de négociation, estimation des risques douaniers).",
              },
              {
                q: "Mobile Money est-il vraiment supporté ?",
                a: "Oui, totalement. Orange Money, Wave, MTN MoMo, Moov Money sont tous acceptés. Pour les packs PAYG, le paiement se fait en ligne sur notre plateforme sécurisée. Pour les abonnements, vous recevez un lien de paiement mobile à chaque renouvellement mensuel.",
              },
              {
                q: "Puis-je annuler mon abonnement à tout moment ?",
                a: "Oui, sans frais. Vous pouvez annuler votre abonnement Standard ou Pro depuis votre espace \"Paramètres\" à tout moment. L'annulation prend effet à la fin de la période en cours — vous continuez à bénéficier de vos crédits jusqu'à la date de renouvellement.",
              },
              {
                q: "Les crédits inutilisés expirent-ils ?",
                a: "Les crédits issus des abonnements mensuels expirent à la fin du mois de facturation (pas de report). Les crédits achetés en PAYG (packs à la carte) sont valides 12 mois à compter de la date d'achat, sans limite de report.",
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-2xl border border-border bg-card px-6 data-[state=open]:border-primary/40"
              >
                <AccordionTrigger className="text-left font-medium text-sm hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        </>
        )}

        {product === 'assistant' && (
          <div className="space-y-10">
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto items-stretch">
              {assistantPlans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                  whileHover={{ y: -6 }}
                >
                  <Card className={`relative overflow-hidden border-2 h-full transition-shadow duration-300 ${
                    plan.is_popular ? 'border-blue-500 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-2xl shadow-blue-600/25' : 'border-border hover:border-blue-500/30 hover:shadow-lg'
                  }`}>
                    <CardHeader className="flex flex-row justify-between items-start pb-2 pt-6">
                      <div className="flex items-center gap-2">
                        <Bot className={`h-5 w-5 ${plan.is_popular ? 'text-white' : 'text-blue-600'}`} />
                        <span className="font-bold text-lg">{plan.display_name}</span>
                      </div>
                      {plan.is_popular && (
                        <Badge className="text-xs bg-white/15 text-white border-white/30 shrink-0">★ Populaire</Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold tracking-tight">{formatPrice(Number(plan.price_yuan))}</span>
                          <span className={`font-medium ${plan.is_popular ? 'text-white/70' : 'text-muted-foreground'}`}>/mois</span>
                        </div>
                        <div className="flex gap-2 text-xs mt-2 flex-wrap">
                          <span className={`rounded-full px-2.5 py-0.5 font-medium ${plan.is_popular ? 'bg-white/15' : 'bg-muted'}`}>{plan.max_numbers} numéro{plan.max_numbers > 1 ? 's' : ''}</span>
                          <span className={`rounded-full px-2.5 py-0.5 font-medium ${plan.is_popular ? 'bg-white/15' : 'bg-muted'}`}>{plan.max_conversations_per_month.toLocaleString('fr-FR')} conv./mois</span>
                        </div>
                      </div>

                      <Button asChild variant={plan.is_popular ? 'secondary' : 'default'} className="w-full transition-transform duration-200 hover:scale-[1.02]">
                        <Link to={`/checkout-assistant?plan=${plan.name}`}>S'abonner</Link>
                      </Button>

                      <ul className="flex flex-col gap-2.5 pt-1 text-sm">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-start gap-2">
                            <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.is_popular ? 'text-white' : 'text-blue-600'}`} />
                            <span className={plan.is_popular ? 'text-white/90' : ''}>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="max-w-3xl mx-auto border rounded-xl p-6 bg-card space-y-3 text-center">
              <MessageCircle className="h-8 w-8 text-blue-600 mx-auto" />
              <h2 className="font-semibold text-base">Comment ça démarre ?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                BizKey WhatsApp Assistant connecte votre numéro WhatsApp Business à un agent automatisé : réponses instantanées,
                base de connaissances, et transfert vers un humain dès que nécessaire. Contactez-nous pour connecter votre numéro
                et configurer votre assistant — la mise en route est accompagnée par notre équipe.
              </p>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
