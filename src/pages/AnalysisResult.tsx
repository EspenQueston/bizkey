import { useEffect, useState } from 'react'
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Star, ShieldCheck, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Copy, CheckCheck, MessageSquare, Zap,
  ChevronRight, ExternalLink, Info, CheckCircle2,
  Globe, ChevronDown, ChevronUp, GitCompare, RefreshCw, ImageOff,
  ImagePlus, Award, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAnalysis, getExchangeRates } from '@/lib/db'
import { Logo } from '@/components/Logo'
import type { Database, AIAnalysisResult, ProductData } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrencyFromCny, DEFAULT_RATE_FALLBACK, type Currency } from '@/lib/currency'

type Analysis = Database['public']['Tables']['analyses']['Row']

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Score-ring/bar "high score" color — must match --primary's light-mode gold, not a CSS var (SVG stroke/inline style can't read theme tokens here). */
const BRAND_GOLD = '#D4AF37'

/** Format a number as Yuan: ¥230 */
const yuan = (n: number | undefined | null): string =>
  n != null && n > 0 ? `\u00A5${n}` : '—'

// ─── Currency conversion panel ────────────────────────────────────────────────
/** Cameroun is the only CEMAC (XAF) country in the sign-up list; every other supported destination is UEMOA (XOF). */
function resolveLocalCurrency(country: string | null | undefined): Currency {
  return country?.trim().toLowerCase() === 'cameroun' ? 'XAF' : 'XOF'
}

function CurrencyPanel({ cny }: { cny: number }) {
  const { profile } = useAuth()
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATE_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)

  useEffect(() => {
    getExchangeRates()
      .then((r) => { setRates(r); setFetchedAt(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!cny || cny <= 0) return null

  const localCurrency = resolveLocalCurrency(profile?.country)
  const localLabel = localCurrency === 'XAF' ? 'FCFA (XAF)' : 'FCFA (XOF)'
  const rateLocal = rates[`CNY_${localCurrency}`] ?? DEFAULT_RATE_FALLBACK[`CNY_${localCurrency}`]
  const rateUsd = rates['CNY_USD'] ?? DEFAULT_RATE_FALLBACK['CNY_USD']

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          💱 Conversion en temps réel
        </span>
        {!loading && fetchedAt && (
          <span className="ml-auto text-[10px] text-muted-foreground/60 flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            {fetchedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-background/80 border border-border p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">Yuan (CNY)</div>
          <div className="text-base font-bold font-serif">{formatCurrencyFromCny(cny, 'CNY', rates)}</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">{localLabel}</div>
          <div className="text-sm font-bold font-serif text-amber-600 dark:text-amber-400">{formatCurrencyFromCny(cny, localCurrency, rates)}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">1 ¥ = {Math.round(rateLocal)} FCFA</div>
        </div>
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
          <div className="text-[10px] text-muted-foreground mb-1">USD</div>
          <div className="text-base font-bold font-serif text-blue-600 dark:text-blue-400">{formatCurrencyFromCny(cny, 'USD', rates)}</div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">1 ¥ = {rateUsd.toFixed(4)} USD</div>
        </div>
      </div>
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? BRAND_GOLD : score >= 50 ? '#f59e0b' : '#ef4444'
  const stars = score >= 80 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 flex items-center justify-center flex-shrink-0">
        <svg className="absolute -rotate-90" width="112" height="112" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
          <circle cx="56" cy="56" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-1000" />
        </svg>
        <div className="text-center z-10">
          <div className="text-3xl font-bold font-serif" style={{ color }}>{score}</div>
          <div className="text-xs text-muted-foreground">/100</div>
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Score de confiance</div>
        <div className="flex gap-0.5 mb-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Star key={i} className={`h-5 w-5 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20 fill-muted-foreground/10'}`} />
          ))}
          <span className="ml-1.5 text-xs text-muted-foreground self-center">{stars}/4</span>
        </div>
        <div className="text-xs font-medium" style={{ color }}>
          {score >= 75 ? '✓ Fournisseur fiable' : score >= 60 ? '⚡ Confiance moyenne' : '⚠ Vérification requise'}
        </div>
      </div>
    </div>
  )
}

function CopyBtn({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button size="sm" variant="outline" className="rounded-full gap-1.5 h-8 text-xs px-3" onClick={handleCopy}>
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copié !' : label}
    </Button>
  )
}

function PlatformBadge({ url }: { url: string }) {
  const u = url ?? ''
  const platform = u.includes('1688') ? '1688.com' : u.includes('taobao') ? 'Taobao' : u.includes('tmall') ? 'Tmall' : u.includes('jd.com') ? 'JD.com' : u.includes('pinduoduo') || u.includes('yangkeduo') ? 'Pinduoduo' : 'Alibaba'
  const colors: Record<string, string> = {
    'Alibaba': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    '1688.com': 'bg-red-500/10 text-red-600 border-red-500/20',
    'Taobao': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    'Tmall': 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    'JD.com': 'bg-red-600/10 text-red-700 border-red-600/20',
    'Pinduoduo': 'bg-pink-600/10 text-pink-700 border-pink-600/20',
  }
  return (
    <Badge variant="outline" className={`rounded-full text-xs gap-1 ${colors[platform] ?? ''}`}>
      <Globe className="h-3 w-3" />{platform}
    </Badge>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AnalysisResultPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<Analysis | null>(
    (location.state as { analysis?: Analysis })?.analysis ?? null
  )
  const [loading, setLoading] = useState(!analysis)
  const [error, setError] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)

  useEffect(() => {
    if (!analysis && id) {
      getAnalysis(id)
        .then((data) => { if (data) setAnalysis(data); else setError('Analyse introuvable') })
        .catch(() => setError('Erreur de chargement'))
        .finally(() => setLoading(false))
    }
  }, [id, analysis])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement de l'analyse...</p>
        </div>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 grid place-items-center mx-auto mb-4">
            <Info className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-semibold">{error || 'Analyse introuvable'}</p>
          <Button asChild variant="outline" className="mt-4 rounded-full">
            <Link to="/app">Retour au tableau de bord</Link>
          </Button>
        </div>
      </div>
    )
  }

  const ai = analysis.ai_analysis as AIAnalysisResult | null
  const rawData = analysis.raw_product_data as ProductData | null
  const score = analysis.confidence_score ?? 0
  const pa = ai?.priceAnalysis
  const breakdown = ai?.confidenceBreakdown
  const currentPrice = analysis.price ?? 0
  const marketAvg = pa?.marketAverage ?? 0
  const pctDiff = pa?.percentageDiff ?? (marketAvg > 0 ? Math.round(((currentPrice - marketAvg) / marketAvg) * 100) : 0)
  const PriceIcon = pctDiff < -5 ? TrendingDown : pctDiff > 5 ? TrendingUp : Minus
  const targetMin = pa?.targetMin ?? (pa as Record<string, unknown> | undefined)?.targetPrice as number | undefined
  const targetMax = pa?.targetMax

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Retour</span>
        </button>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="rounded-full h-8 px-3 text-xs">
            <Link to="/app/compare"><GitCompare className="h-3.5 w-3.5 mr-1" />Comparer</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-full h-8 px-3 text-xs">
            <Link to={`/app/negotiate?analysisId=${analysis.id}`}><MessageSquare className="h-3.5 w-3.5 mr-1" />Négocier</Link>
          </Button>
          {/* Image-sourced analyses have no originating link — offering a dead
              "Produit" button would just look broken. */}
          {analysis.product_url && (
            <Button asChild size="sm" className="rounded-full h-8 px-3 text-xs">
              <a href={analysis.product_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />Produit
              </a>
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">

        {/* ══ BANNER ══ */}
        <div className="rounded-2xl border-2 border-primary/20 overflow-hidden">
          <div className="bg-primary/8 border-b border-primary/15 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo variant="monogram" size="sm" asLink={false} className="flex-shrink-0" />
              <code className="text-xs font-semibold tracking-widest text-muted-foreground">
                ╔══ ANALYSE : {analysis.product_name?.toUpperCase().slice(0, 28) ?? 'PRODUIT'} ══╗
              </code>
            </div>
            <PlatformBadge url={analysis.product_url ?? ''} />
          </div>

          <div className="p-5 sm:p-6 bg-gradient-to-br from-primary/3 to-transparent">
            {/* Images */}
            {rawData?.images && rawData.images.length > 0 ? (
              <div className="mb-5">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {rawData.images.slice(0, 6).map((img, i) => (
                    <img key={i} src={img} alt={`${analysis.product_name ?? 'Produit'} - ${i + 1}`}
                      className="h-28 sm:h-36 w-28 sm:w-36 rounded-xl object-cover border-2 border-border hover:border-primary/50 transition-all flex-shrink-0 cursor-pointer hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5 h-28 sm:h-36 w-28 sm:w-36 rounded-xl border-2 border-dashed border-border bg-secondary/40 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <ImageOff className="h-6 w-6" />
                <span className="text-[10px] text-center px-2 leading-tight">Aperçu non disponible</span>
              </div>
            )}

            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight mb-1 leading-tight">
              {analysis.product_name ?? 'Produit analysé'}
            </h1>
            <p className="text-muted-foreground text-sm mb-2">
              {analysis.supplier_name ?? 'Fournisseur non identifié'}
            </p>

            <div className="flex items-center gap-2 flex-wrap mb-5">
              {rawData?.dataSource && (
                <Badge variant="outline" className={`text-[10px] rounded-full gap-1 ${
                  rawData.dataSource === 'onebound' ? 'border-blue-500/30 text-blue-600 bg-blue-500/5' :
                  rawData.dataSource === 'ai_estimate' ? 'border-purple-500/30 text-purple-600 bg-purple-500/5' :
                  'border-yellow-500/30 text-yellow-600 bg-yellow-500/5'
                }`}>
                  {rawData.dataSource === 'onebound' ? '✓ Données vérifiées' :
                   rawData.dataSource === 'ai_estimate' ? '⚡ Estimation IA' : '⚠ Données limitées'}
                </Badge>
              )}
              {rawData?.rating != null && rawData.rating > 0 && (
                <Badge variant="secondary" className="text-[10px] rounded-full gap-1">
                  <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />{rawData.rating.toFixed(1)}/5 vendeur
                </Badge>
              )}
              {rawData?.sales != null && Number(rawData.sales) > 0 && (
                <Badge variant="secondary" className="text-[10px] rounded-full gap-1">
                  🔥 {String(rawData.sales)} ventes
                </Badge>
              )}
              {rawData?.reviews != null && rawData.reviews > 0 && (
                <Badge variant="secondary" className="text-[10px] rounded-full gap-1">
                  💬 {rawData.reviews} avis
                </Badge>
              )}
            </div>

            {rawData?.dataSource === 'fallback' && (
              <div className="mb-5 p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                    Données réelles indisponibles pour ce lien
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Le nom, le prix et les caractéristiques ci-dessous sont des estimations génériques, pas les vraies données du produit — l'API n'a pas pu récupérer ce lien spécifique. Pour une analyse fiable, essayez une recherche par mot-clé ou par image du même produit.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button asChild size="sm" variant="outline" className="rounded-full h-8 text-xs gap-1.5 border-yellow-500/40">
                      <Link to="/app/analyze"><Award className="h-3.5 w-3.5" />Recherche par mot-clé</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-full h-8 text-xs gap-1.5 border-yellow-500/40">
                      <Link to="/app/analyze"><ImagePlus className="h-3.5 w-3.5" />Recherche par image</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Score + price grid */}
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <ScoreRing score={score} />
              <div className="flex-1 space-y-3">
                {/* Price cards — all in YUAN ¥ */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-background/70 border border-border text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Prix affiché</div>
                    <div className="font-bold text-lg font-serif text-foreground">{yuan(currentPrice)}</div>
                    <div className="text-xs text-muted-foreground">/ unité</div>
                  </div>
                  <div className="p-3 rounded-xl bg-background/70 border border-border text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">MOQ</div>
                    <div className="font-bold text-lg font-serif">{analysis.moq ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">unités min.</div>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">💡 Prix cible</div>
                    <div className="font-bold text-base font-serif text-primary">{yuan(targetMin)}</div>
                    <div className="text-xs text-primary/70">{targetMax ? `–\u00A5${targetMax}` : ''}</div>
                  </div>
                </div>
                {/* Live currency conversion */}
                {currentPrice > 0 && <CurrencyPanel cny={currentPrice} />}
              </div>
            </div>
          </div>
        </div>

        {/* ══ SCORE DE CONFIANCE ══ */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              📊 SCORE DE CONFIANCE : {score}/100
              <span className="ml-1">{Array.from({ length: score >= 80 ? 4 : score >= 65 ? 3 : score >= 40 ? 2 : 1 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 inline fill-yellow-400 text-yellow-400" />)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${score}%`, backgroundColor: score >= 70 ? BRAND_GOLD : score >= 50 ? '#f59e0b' : '#ef4444' }} />
              </div>
              <span className="text-xs font-bold w-10 text-right text-muted-foreground">{score}%</span>
            </div>
            {rawData && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Note vendeur', value: rawData.rating && rawData.rating > 0 ? `${rawData.rating.toFixed(1)}/5` : 'Non communiquée' },
                  { label: 'Ventes réalisées', value: rawData.sales && rawData.sales > 0 ? rawData.sales.toLocaleString('fr-FR') : 'Non communiquées' },
                  { label: 'Avis clients', value: rawData.reviews > 0 ? `${rawData.reviews} avis` : 'Aucun avis' },
                ].map((s) => (
                  <div key={s.label} className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">{s.label}</div>
                    <div className="text-sm font-semibold">{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              {breakdown?.positifs?.map((item: string, i: number, arr: string[]) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground/40 font-mono text-sm flex-shrink-0 mt-0.5 select-none w-6">
                    {i === arr.length - 1 && !breakdown.negatifs?.length ? '└─' : '├─'}
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
              {breakdown?.negatifs?.map((item: string, i: number, arr: string[]) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground/40 font-mono text-sm flex-shrink-0 mt-0.5 select-none w-6">
                    {i === arr.length - 1 ? '└─' : '├─'}
                  </span>
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium text-yellow-700 dark:text-yellow-400">Avertissement : </span>{item}
                  </span>
                </div>
              ))}
              {!breakdown && ai?.confidenceReason && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground/40 font-mono text-sm flex-shrink-0 mt-0.5 select-none w-6">└─</span>
                  <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{ai.confidenceReason}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ══ ANALYSE DE PRIX ══ */}
        {pa && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PriceIcon className="h-4 w-4 text-primary" />
                💰 ANALYSE DE PRIX (en Yuan ¥)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {[
                {
                  prefix: '├─',
                  label: 'Prix affiché',
                  value: `${yuan(currentPrice)}/unité${analysis.moq ? ` (MOQ: ${analysis.moq})` : ''}`,
                  cls: '',
                },
                {
                  prefix: '├─',
                  label: 'Prix marché moyen',
                  value: `${yuan(marketAvg)}/unité`,
                  cls: '',
                },
                {
                  prefix: '├─',
                  label: 'Évaluation',
                  value: pa.evaluation ?? (pctDiff > 5 ? `${pctDiff}% au-dessus du marché` : pctDiff < -5 ? `${Math.abs(pctDiff)}% en-dessous du marché` : 'Dans la moyenne du marché'),
                  cls: pctDiff > 5 ? 'text-destructive font-medium' : pctDiff < -5 ? 'text-primary font-medium' : 'text-yellow-600 dark:text-yellow-400 font-medium',
                },
                {
                  prefix: '└─',
                  label: '💡 Prix cible négociation',
                  value: targetMin && targetMax ? `${yuan(targetMin)}–\u00A5${targetMax}` : yuan(targetMin),
                  cls: 'text-primary font-bold',
                },
              ].map((row, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="text-muted-foreground/40 font-mono text-sm flex-shrink-0 select-none w-6">{row.prefix}</span>
                  <span className="text-sm text-muted-foreground flex-shrink-0 min-w-[170px]">{row.label}</span>
                  <span className={`text-sm ${row.cls}`}>{row.value}</span>
                </div>
              ))}

              {/* Price bar */}
              {currentPrice > 0 && marketAvg > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="text-primary font-medium">Cible {yuan(targetMin)}</span>
                    <span>Marché {yuan(marketAvg)}</span>
                    <span className={pctDiff > 5 ? 'text-destructive font-medium' : 'text-primary font-medium'}>
                      Affiché {yuan(currentPrice)}
                    </span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden relative">
                    <div className="h-full bg-primary/25 absolute left-0 top-0 rounded-full"
                      style={{ width: `${Math.min(100, ((targetMax ?? (targetMin ?? currentPrice * 0.88)) / currentPrice) * 100)}%` }} />
                    <div className="h-full bg-primary absolute left-0 top-0 rounded-full"
                      style={{ width: `${Math.min(100, ((targetMin ?? currentPrice * 0.78) / currentPrice) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Conversion for market average too */}
              {marketAvg > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Prix marché moyen converti :</p>
                  <CurrencyPanel cny={marketAvg} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══ POINTS DE VIGILANCE ══ */}
        {ai?.warnings && ai.warnings.length > 0 && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4" />
                ⚠️ POINTS DE VIGILANCE
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {ai.warnings.map((w, i, arr) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-yellow-500/40 font-mono text-sm flex-shrink-0 mt-0.5 select-none w-6">
                    {i === arr.length - 1 ? '└─' : '├─'}
                  </span>
                  <span className="h-5 w-5 rounded-full bg-yellow-500/20 grid place-items-center flex-shrink-0 mt-0.5 text-yellow-700 dark:text-yellow-400 font-bold text-xs">{i + 1}</span>
                  <p className="text-sm leading-relaxed">{w}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ══ MESSAGE RECOMMANDÉ ══ */}
        {ai?.contactMessage && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                📝 MESSAGE RECOMMANDÉ (chinois)
              </CardTitle>
              <CopyBtn text={ai.contactMessage} label="Copier le message" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-base leading-loose font-serif">{ai.contactMessage}</p>
              </div>
              {ai.contactTranslation && (
                <div>
                  <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition py-1"
                  >
                    {showTranslation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showTranslation ? 'Masquer' : 'Voir'} la traduction française
                  </button>
                  {showTranslation && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                      <p className="text-sm text-muted-foreground leading-relaxed italic">{ai.contactTranslation}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3 w-3 flex-shrink-0" />
                Copier et envoyer via Alibaba Trade Manager, WeChat ou l'app 1688
              </p>
            </CardContent>
          </Card>
        )}

        {/* ══ RÉSUMÉ + TACTIQUES ══ */}
        <div className="grid sm:grid-cols-2 gap-4">
          {ai?.summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold mb-1 uppercase tracking-wide text-primary">Résumé IA</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ai.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {(ai?.negotiationTactics?.length || ai?.negotiationStrategy?.tactics?.length) && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Tactiques recommandées
                </p>
                <div className="space-y-1.5">
                  {(ai?.negotiationTactics ?? ai?.negotiationStrategy?.tactics ?? []).map((t, i, arr) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground/40 font-mono flex-shrink-0 w-5 select-none">{i === arr.length - 1 ? '└─' : '├─'}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ══ ACTIONS ══ */}
        <div className="rounded-2xl border border-border p-4 bg-card">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-semibold">🔗 Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {analysis.product_url ? (
              <Button asChild variant="outline" className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
                <a href={analysis.product_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />Contacter fournisseur
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline" className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
                <Link to="/app/analyze">
                  <ImagePlus className="h-4 w-4" />Trouver ce produit
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
              <Link to={`/app/negotiate?analysisId=${analysis.id}`}>
                <MessageSquare className="h-4 w-4" />Générer messages
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
              <Link to="/app/quotes" state={{ prefillAnalysis: analysis }}>
                <FileText className="h-4 w-4" />Demander un devis
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
              <Link to="/app/compare">
                <GitCompare className="h-4 w-4" />Comparer produits
              </Link>
            </Button>
            <Button asChild className="h-auto py-3 rounded-xl flex-col gap-1.5 text-xs font-medium">
              <Link to="/app/analyze">
                <Zap className="h-4 w-4" />Analyser autre produit
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
