import { useState, useRef } from 'react'
import {
  Search, Paperclip, Link as LinkIcon, Sparkles, Loader2,
  TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle,
  CheckCircle, XCircle, ChevronRight, Star, ExternalLink,
  ArrowRight, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SignUpModal } from '@/components/SignUpModal'
import { useAuth } from '@/contexts/AuthContext'
import { analyzeFree, type FreeAnalysisReport } from '@/lib/api'
import {
  getFreeRequestState, incrementFreeRequests, savePendingRequest,
  getRemainingFree, FREE_REQUEST_MAX,
} from '@/hooks/use-free-requests'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

type InputMode = 'url' | 'image' | 'keyword'
type ReportSection = 'id' | 'price' | 'popularity' | 'profitability' | 'verdict' | 'warnings'

const SECTIONS: ReportSection[] = ['id', 'price', 'popularity', 'profitability', 'verdict', 'warnings']

export function FreeAnalysisTool() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<InputMode>('url')
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingSections, setLoadingSections] = useState<ReportSection[]>([])
  const [report, setReport] = useState<FreeAnalysisReport | null>(null)
  const [error, setError] = useState('')
  const [showSignUp, setShowSignUp] = useState(false)
  const [pendingInput, setPendingInput] = useState<{ type: 'url'; value: string } | { type: 'image'; base64: string; fileName: string; mimeType: string } | { type: 'keyword'; value: string } | null>(null)

  const remaining = getRemainingFree()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop grande (max 10 Mo)')
      return
    }
    setImageFile(file)
    setUrl('')
  }

  async function runAnalysis(input: { type: 'url'; value: string } | { type: 'image'; base64: string; fileName: string; mimeType: string } | { type: 'keyword'; value: string }) {
    setLoading(true)
    setReport(null)
    setError('')
    setLoadingSections([])

    try {
      const reportData = await analyzeFree(input)

      // Progressive reveal — show sections one by one
      for (const section of SECTIONS) {
        await new Promise(r => setTimeout(r, 350))
        setLoadingSections(prev => [...prev, section])
      }

      setReport(reportData)
      incrementFreeRequests()

      // Save free report to localStorage so dashboard can pick it up
      try {
        const freeUrl = input.type === 'url' ? input.value : ''
        localStorage.setItem('bizkey_free_report', JSON.stringify({
          report: reportData,
          url: freeUrl,
          ts: Date.now(),
        }))
      } catch { /* ignore storage errors */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze() {
    setError('')

    // Build input object
    let input: Parameters<typeof runAnalysis>[0] | null = null

    if (mode === 'url') {
      if (!url.trim()) { setError('Collez un lien produit'); return }
      input = { type: 'url', value: url.trim() }
    } else if (mode === 'keyword') {
      if (!keyword.trim()) { setError('Entrez un mot-clé de recherche'); return }
      if (keyword.trim().length < 2) { setError('Mot-clé trop court (2 caractères minimum)'); return }
      input = { type: 'keyword', value: keyword.trim() }
    } else {
      if (!imageFile) { setError('Importez une image'); return }
      const base64 = await fileToBase64(imageFile)
      input = { type: 'image', base64, fileName: imageFile.name, mimeType: imageFile.type }
    }

    // Check if user is logged in → redirect to /analyze with URL pre-filled
    if (user) {
      if (mode === 'url' && url.trim()) {
        navigate('/app/analyze?url=' + encodeURIComponent(url.trim()))
      } else {
        navigate('/app/analyze')
      }
      return
    }

    // Anonymous flow
    const state = getFreeRequestState()

    if (state.used === 0) {
      // First request — run directly
      await runAnalysis(input)
    } else if (state.used === 1) {
      // Second request — require signup first
      savePendingRequest(
        input.type === 'image'
          ? { type: 'image', value: input.fileName }
          : { type: input.type, value: input.value },
      )
      setPendingInput(input)
      setShowSignUp(true)
    } else if (state.used >= 2) {
      // 3rd request — if logged in (post-signup) it's fine, otherwise gate
      setShowSignUp(true)
    }
  }

  function handleSignUpSuccess() {
    setShowSignUp(false)
    if (pendingInput) {
      void runAnalysis(pendingInput)
      setPendingInput(null)
    } else if (report) {
      // User signed up after seeing the free report — send to /analyze with URL pre-filled
      const freeUrl = mode === 'url' ? url : ''
      if (freeUrl) {
        navigate('/app/analyze?url=' + encodeURIComponent(freeUrl) + '&from=free')
      } else {
        navigate('/app/analyze')
      }
    }
  }

  const verdictConfig = {
    good: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800', label: '✅ Bon produit à importer' },
    moderate: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800', label: '⚠️ Risque modéré' },
    bad: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: '❌ Déconseillé' },
  }

  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-green-600', label: '📈 En hausse' },
    down: { icon: TrendingDown, color: 'text-red-600', label: '📉 En baisse' },
    stable: { icon: Minus, color: 'text-muted-foreground', label: '➡️ Stable' },
  }

  return (
    <div className="w-full space-y-6">
      {/* Input Widget */}
      <Card className="border-2 border-primary/30 shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-primary grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Testez gratuitement</p>
              <p className="text-xs text-muted-foreground">Analysez n'importe quel produit en 30 secondes.</p>
            </div>
            {!user && (
              <Badge variant="secondary" className="ml-auto text-xs rounded-full">
                {remaining}/{FREE_REQUEST_MAX} gratuites
              </Badge>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden mb-4">
            <button
              onClick={() => setMode('url')}
              className={`flex-1 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors ${mode === 'url' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <LinkIcon className="h-4 w-4" />
              <span>🔗 Coller un lien</span>
            </button>
            <button
              onClick={() => setMode('keyword')}
              className={`flex-1 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors ${mode === 'keyword' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Search className="h-4 w-4" />
              <span>🔍 Mot-clé</span>
            </button>
            <button
              onClick={() => setMode('image')}
              className={`flex-1 py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors ${mode === 'image' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Paperclip className="h-4 w-4" />
              <span>📎 Image</span>
            </button>
          </div>

          {mode === 'url' ? (
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Collez un lien 1688 / Taobao / Alibaba / AliExpress…"
              className="h-12 rounded-xl text-sm mb-3"
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
          ) : mode === 'keyword' ? (
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Ex: sac à dos, montre connectée, chaussures de sport…"
              className="h-12 rounded-xl text-sm mb-3"
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
          ) : (
            <div
              className="border-2 border-dashed border-border rounded-xl p-5 mb-3 cursor-pointer hover:border-primary/60 transition-colors text-center"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
              {imageFile ? (
                <p className="text-sm font-medium text-foreground">{imageFile.name}</p>
              ) : (
                <>
                  <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Cliquez pour importer une image (jpg, png, webp — max 10 Mo)</p>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive mb-3">{error}</p>}

          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base shadow-lg shadow-primary/20 group"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" />Analyse en cours…</>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                🔍 Analyser ce produit — Gratuit
                <ArrowRight className="h-5 w-5 ml-auto group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Skeleton / Progressive Report */}
      {(loading || report) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-bold">Rapport d'Analyse Produit — BizKey</h2>
          </div>

          {/* Section 1 — Identification */}
          {loading && !loadingSections.includes('id') ? (
            <SectionSkeleton title="1. Identification du produit" />
          ) : (report && loadingSections.includes('id')) ? (
            <ReportSection title="1. Identification du produit" delay={0}>
              <div className="flex gap-4 items-start">
                {report.image_url && (
                  <img src={report.image_url} alt={report.product_name} className="w-20 h-20 rounded-xl object-cover border border-border shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-lg leading-snug">{report.product_name}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">{report.category}</Badge>
                </div>
              </div>
            </ReportSection>
          ) : null}

          {/* Section 2 — Prix */}
          {loading && !loadingSections.includes('price') ? (
            <SectionSkeleton title="2. Prix & Fournisseurs" />
          ) : (report && loadingSections.includes('price')) ? (
            <ReportSection title="2. Prix & Fournisseurs" delay={1}>
              <div className="grid sm:grid-cols-3 gap-3 mb-4">
                <Stat label="Prix min" value={`¥${report.price_min}`} />
                <Stat label="Prix max" value={`¥${report.price_max}`} />
                <Stat label="MOQ" value={`${report.moq} unités`} />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">TOP 3 Fournisseurs</p>
              <div className="space-y-2">
                {report.suppliers.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-secondary/50 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">¥{s.price_min}–¥{s.price_max} · MOQ {s.moq}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-xs">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span>{s.rating} ({s.reviews})</span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </ReportSection>
          ) : null}

          {/* Section 3 — Popularité */}
          {loading && !loadingSections.includes('popularity') ? (
            <SectionSkeleton title="3. Analyse de popularité" />
          ) : (report && loadingSections.includes('popularity')) ? (
            <ReportSection title="3. Analyse de popularité" delay={2}>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <Stat label="Volume de ventes" value={report.sales_volume} />
                <Stat label="Note moyenne" value={`${report.avg_rating}/5`} icon={<Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />} />
                <Stat label="Total avis" value={`${report.total_reviews}`} />
              </div>
              <div className={`flex items-center gap-2 text-sm font-medium ${trendConfig[report.trend].color}`}>
                {report.trend === 'up' && <TrendingUp className="h-4 w-4" />}
                {report.trend === 'down' && <TrendingDown className="h-4 w-4" />}
                {report.trend === 'stable' && <Minus className="h-4 w-4" />}
                Tendance : {trendConfig[report.trend].label}
              </div>
            </ReportSection>
          ) : null}

          {/* Section 4 — Rentabilité */}
          {loading && !loadingSections.includes('profitability') ? (
            <SectionSkeleton title="4. Évaluation de rentabilité" />
          ) : (report && loadingSections.includes('profitability')) ? (
            <ReportSection title="4. Évaluation de rentabilité" delay={3}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Stat label="Prix d'achat estimé" value={`¥${report.buy_price}`} />
                <Stat label="Transport vers Afrique" value={`¥${report.shipping_cost_min}–¥${report.shipping_cost_max}`} />
                <Stat label="Prix revente conseillé" value={`¥${report.resale_price}`} />
                <Stat label="Marge estimée" value={`${report.margin_percent}%`} highlight />
              </div>
            </ReportSection>
          ) : null}

          {/* Section 5 — Verdict */}
          {loading && !loadingSections.includes('verdict') ? (
            <SectionSkeleton title="5. Verdict BizKey" />
          ) : (report && loadingSections.includes('verdict')) ? (
            <ReportSection title="5. Verdict BizKey" delay={4}>
              <div className={`p-4 rounded-2xl border ${verdictConfig[report.verdict].bg}`}>
                <p className={`font-bold text-base mb-2 ${verdictConfig[report.verdict].color}`}>
                  {verdictConfig[report.verdict].label}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{report.verdict_reason}</p>
                <p className="text-sm text-muted-foreground mt-2">💡 {report.best_option}</p>
              </div>
            </ReportSection>
          ) : null}

          {/* Section 6 — Avertissements */}
          {loading && !loadingSections.includes('warnings') ? (
            <SectionSkeleton title="6. Avertissements" />
          ) : (report && loadingSections.includes('warnings')) ? (
            <ReportSection title="6. Avertissements" delay={5}>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  {report.customs_risk ? (
                    <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <span>
                    Restrictions douanières : <strong>{report.customs_risk ? 'Oui — vérifier avant importation' : 'Non identifiée'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {report.counterfeit_risk ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  <span>
                    Risque contrefaçon : <strong>{report.counterfeit_risk ? 'Oui — faire attention' : 'Faible'}</strong>
                  </span>
                </div>
              </div>
            </ReportSection>
          ) : null}

          {/* Post-report CTA — non-logged-in user */}
          {report && !user && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/8 to-chart-2/8 border border-primary/25 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/15 grid place-items-center shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Sauvegardez ce rapport — c'est gratuit</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Créez un compte pour accéder à l'analyse complète, comparer des fournisseurs et négocier avec l'IA.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full gap-1.5 flex-1"
                  onClick={() => {
                    savePendingRequest(
                      mode === 'keyword' ? { type: 'keyword', value: keyword }
                      : mode === 'image' ? { type: 'image', value: imageFile?.name ?? '' }
                      : { type: 'url', value: url },
                    )
                    setShowSignUp(true)
                  }}
                >
                  Créer un compte gratuit
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/login">Se connecter</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Post-report CTA — logged-in user, after free report */}
          {report && user && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/8 to-chart-2/8 border border-primary/25 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 grid place-items-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Analyse rapide terminée</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lancez une analyse approfondie dans votre tableau de bord pour des recommandations encore plus précises.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {mode === 'url' && url && (
                  <Button
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => navigate('/app/analyze?url=' + encodeURIComponent(url) + '&from=free')}
                  >
                    Analyse complète →
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {remaining === 0 && (
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to="/pricing">Voir les offres</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <SignUpModal
        open={showSignUp}
        onSuccess={handleSignUpSuccess}
        onClose={() => setShowSignUp(false)}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionSkeleton({ title }: { title: string }) {
  return (
    <Card className="border">
      <CardContent className="p-5 space-y-3">
        <p className="font-serif font-semibold text-sm text-muted-foreground">{title}</p>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </CardContent>
    </Card>
  )
}

function ReportSection({ title, children, delay: _d }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <Card className="border animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardContent className="p-5">
        <p className="font-serif font-semibold text-sm text-primary mb-3 uppercase tracking-wide">{title}</p>
        {children}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl bg-secondary/50 ${highlight ? 'bg-primary/10 border border-primary/20' : ''}`}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        {icon}
        <span className={`font-bold text-base ${highlight ? 'text-primary' : ''}`}>{value}</span>
      </div>
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
