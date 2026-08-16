import { useSearchParams } from 'react-router-dom'
import { Sparkles, ShieldCheck, ArrowRight, Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { ProductAnalyzeForm } from '@/components/ProductAnalyzeForm'

const SUPPORTED_PLATFORMS = [
  { label: '1688', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  { label: 'Taobao', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  { label: 'JD.com', color: 'bg-red-600/10 text-red-700 border-red-600/20' },
  { label: 'Pinduoduo', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  { label: 'Alibaba', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  { label: 'AliExpress', color: 'bg-orange-600/10 text-orange-700 border-orange-600/20' },
]

// This page and the dashboard home render the exact same ProductAnalyzeForm
// widget — this file only supplies the marketing-style framing around it.
export default function AnalyzePage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const fromFree = searchParams.get('from') === 'free'

  const isAdmin = profile?.is_admin === true
  const tier = isAdmin ? 'pro' : (profile?.subscription_tier ?? 'free')
  const creditsLeft = isAdmin
    ? 999
    : (profile?.basic_credits_remaining ?? profile?.credits_remaining ?? 0) + (profile?.payg_basic_credits ?? 0)

  return (
    <div className="min-h-screen bg-background relative">
      <div className="aurora-bg opacity-40"><div className="aurora-blob-3" /></div>
      <div className="max-w-2xl mx-auto px-4 py-12 relative">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="rounded-full mb-4 px-4 py-1">
            <Sparkles className="h-3 w-3 text-primary" />
            Analyse IA en temps réel
          </Badge>
          <h1 className="font-serif text-4xl font-bold tracking-tight mb-3">Analyser un produit</h1>
          <p className="text-muted-foreground leading-relaxed">
            Collez un lien produit, uploadez une image, ou décrivez ce que vous cherchez — l'IA analyse le marché et génère un rapport complet avec score de confiance, prix et stratégie de négociation.
          </p>

          {fromFree && (
            <div className="mt-5 inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/8 border border-primary/25 text-left">
              <div className="h-8 w-8 rounded-full bg-primary/15 grid place-items-center shrink-0">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Continuez depuis votre analyse gratuite</p>
                <p className="text-xs text-muted-foreground">L'URL a été préremplie. Lancez l'analyse complète.</p>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-primary/10 border border-yellow-500/20 text-sm">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold text-yellow-700 dark:text-yellow-400">Admin Pro</span>
              <span className="text-muted-foreground">— Analyses illimitées</span>
            </div>
          )}
          {!isAdmin && tier === 'free' && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>{creditsLeft} crédit{creditsLeft !== 1 ? 's' : ''} restant{creditsLeft !== 1 ? 's' : ''}</span>
            </div>
          )}
          {!isAdmin && tier !== 'free' && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
              <Crown className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-primary capitalize">Plan {tier}</span>
              <span className="text-muted-foreground">— Analyses illimitées</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {SUPPORTED_PLATFORMS.map((p) => (
            <span key={p.label} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${p.color}`}>{p.label}</span>
          ))}
        </div>

        <ProductAnalyzeForm />

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Analyse sécurisée
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Vision IA multimodale
          </div>
        </div>
      </div>
    </div>
  )
}
