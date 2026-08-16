import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  Search, Info, LinkIcon, Sparkles, X,
  Crown, Zap, CheckCircle2, Lock, ImagePlus, Upload, FileImage,
  ExternalLink, Package, Award, Star, TrendingUp,
  MessageSquare, Heart, BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { analyzeProduct, findBestProducts } from '@/lib/api'
import type { AnalyzeInput, BestProductMatch } from '@/lib/api'

const EXAMPLE_URLS = [
  'https://detail.1688.com/offer/810352749783.html',
  'http://detail.m.1688.com/page/index.htm?offerId=810352749783',
  'https://item.taobao.com/item.htm?id=123456789',
  'https://item.jd.com/100012345678.html',
  'https://mobile.yangkeduo.com/goods.html?goods_id=123456',
]

const PRO_FEATURES = [
  'Analyses illimitées',
  'Score de confiance IA avancé',
  'Négociation automatisée',
  'Comparaison multi-fournisseurs',
  'Export PDF des rapports',
  'Support prioritaire 24/7',
]

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_SIZE_MB = 8

type InputMode = 'url' | 'image' | 'keyword'

// ─── Best-product card — shared by keyword and image "best 3" results ────────
function BestProductCard({
  product, rank, onAnalyze, disabled,
}: {
  product: BestProductMatch
  rank: number
  onAnalyze: (detailUrl: string) => void
  disabled: boolean
}) {
  const p = product
  return (
    <div className="relative rounded-2xl border-2 border-border hover:border-primary/40 bg-card overflow-hidden transition-all">
      {rank === 0 && (
        <div className="absolute top-2 left-2 z-10">
          <Badge className="bg-primary text-primary-foreground rounded-full text-[10px] gap-1 shadow">
            <Award className="h-3 w-3" />
            Meilleur choix
          </Badge>
        </div>
      )}
      <div className="flex gap-3 p-3">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            className="w-20 h-20 rounded-xl object-cover border border-border shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-secondary grid place-items-center shrink-0">
            <Package className="h-7 w-7 text-muted-foreground/30" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-serif font-medium line-clamp-2 leading-tight">{p.title}</p>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-primary">{p.match_score}%</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">match</div>
            </div>
          </div>
          <p className="text-sm font-serif font-bold">¥{p.price.toFixed(2)}<span className="text-xs font-sans font-normal text-muted-foreground"> · MOQ {p.moq}</span></p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{p.sales.toLocaleString()} ventes</span>
            {p.reviews !== null && (
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.reviews.toLocaleString()} avis</span>
            )}
            {p.rating !== null && (
              <span className={`flex items-center gap-1 ${p.rating >= 4 ? 'text-primary' : ''}`}>
                <Star className="h-3 w-3" />{p.rating.toFixed(1)}/5
              </span>
            )}
            {p.favorites !== null && (
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.favorites.toLocaleString()}</span>
            )}
            {p.supplier_years !== null && (
              <span>{p.supplier_years} an(s) sur la plateforme</span>
            )}
            {p.certified && (
              <span className="flex items-center gap-1 text-primary"><BadgeCheck className="h-3 w-3" />Vérifié</span>
            )}
          </div>
          {p.insight && (
            <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1 pt-0.5">
              <Info className="h-3 w-3 flex-shrink-0 mt-0.5 text-primary/70" />
              <span>{p.insight}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <a
          href={p.detail_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Voir sur 1688 <ExternalLink className="h-3 w-3" />
        </a>
        <Button
          type="button"
          size="sm"
          className="rounded-full gap-1.5"
          disabled={disabled}
          onClick={() => onAnalyze(p.detail_url)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Analyser ce produit
        </Button>
      </div>
    </div>
  )
}

/**
 * The core "analyze a product" widget — link / image / keyword-best-3 modes,
 * submit + upgrade-gate logic. Shared verbatim between the /analyze page and
 * the dashboard home, so both are the same underlying experience.
 */
export function ProductAnalyzeForm() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlParam = searchParams.get('url') ?? ''
  const modeParam = searchParams.get('mode')
  const initialMode: InputMode = modeParam === 'image' || modeParam === 'keyword' ? modeParam : 'url'

  const [mode, setMode] = useState<InputMode>(initialMode)

  // Syncs mode when ?mode= changes on an already-mounted instance — e.g. the
  // mobile search sheet navigating here while already on this page, where
  // React Router re-renders in place instead of remounting the component.
  useEffect(() => {
    if (modeParam === 'image' || modeParam === 'keyword') setMode(modeParam)
  }, [modeParam])

  const [url, setUrl] = useState(urlParam)
  const [urlError, setUrlError] = useState('')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const [keyword, setKeyword] = useState('')
  const [bestProducts, setBestProducts] = useState<BestProductMatch[]>([])
  const [bestLoading, setBestLoading] = useState(false)
  const [bestError, setBestError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'analyzing'>('form')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isAdmin = profile?.is_admin === true
  const tier = isAdmin ? 'pro' : (profile?.subscription_tier ?? 'free')
  const creditsLeft = isAdmin
    ? 999
    : (profile?.basic_credits_remaining ?? profile?.credits_remaining ?? 0) + (profile?.payg_basic_credits ?? 0)
  const canAnalyze = isAdmin || tier !== 'free' || creditsLeft > 0

  useEffect(() => {
    if (!isAdmin && tier === 'free' && creditsLeft === 0 && user) {
      const timer = setTimeout(() => setShowUpgradeModal(true), 600)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, tier, creditsLeft, user])

  function isValidUrl(u: string) {
    try {
      const host = new URL(u).hostname
      return (
        host.includes('alibaba.com') ||
        host.includes('1688.com') ||
        host.includes('taobao.com') ||
        host.includes('tmall.com') ||
        host.includes('aliexpress.com') ||
        host.includes('e.tb.cn') ||
        host.includes('jd.com') ||
        host.includes('yangkeduo.com') ||
        host.includes('pinduoduo.com')
      )
    } catch {
      return false
    }
  }

  function validateAndSetImage(file: File): boolean {
    setImageError('')
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Format non supporté. Utilisez JPG, PNG, WebP ou GIF.')
      return false
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setImageError(`Image trop lourde. Maximum ${MAX_IMAGE_SIZE_MB} Mo.`)
      return false
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
    return true
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
    setBestProducts([])
    setBestError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) validateAndSetImage(file)
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) validateAndSetImage(file)
  }

  async function handleImageSearch() {
    if (!imagePreview || !imageFile) return
    setBestLoading(true)
    setBestError('')
    setBestProducts([])
    try {
      const base64 = imagePreview.split(',')[1]
      const data = await findBestProducts({ type: 'image', base64, mimeType: imageFile.type })
      setBestProducts(data.results)
      if (data.results.length === 0) setBestError('Aucun produit similaire trouvé sur 1688.')
    } catch (err) {
      setBestError(err instanceof Error ? err.message : 'Erreur de recherche par image')
    } finally {
      setBestLoading(false)
    }
  }

  async function runAnalysis(input: AnalyzeInput) {
    setLoading(true)
    setStep('analyzing')
    setError('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await analyzeProduct(input, controller.signal)
      navigate(`/app/analysis/${result.analysis.id}`, { state: { analysis: result.analysis } })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStep('form')
        return
      }
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse"
      setError(msg)
      setStep('form')
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  function handleCancelAnalysis() {
    abortControllerRef.current?.abort()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUrlError('')
    setImageError('')

    if (!user) { navigate('/login'); return }
    if (!canAnalyze) { setShowUpgradeModal(true); return }

    if (mode === 'url') {
      if (!url.trim()) { setUrlError('Veuillez entrer une URL'); return }
      if (!isValidUrl(url.trim())) {
        setUrlError('URL non supportée. Utilisez Alibaba, 1688, Taobao, Tmall, AliExpress ou e.tb.cn')
        return
      }
      await runAnalysis({ type: 'url', productUrl: url.trim() })
    } else if (mode === 'image') {
      if (!imageFile || !imagePreview) { setImageError("Veuillez sélectionner une image"); return }
      const base64 = imagePreview.split(',')[1]
      await runAnalysis({ type: 'image', base64, fileName: imageFile.name, mimeType: imageFile.type })
    }
  }

  async function handleFindBest() {
    if (!keyword.trim() || keyword.trim().length < 2) {
      setBestError('Mot-clé trop court (2 caractères minimum)')
      return
    }
    setBestLoading(true)
    setBestError('')
    setBestProducts([])
    try {
      const data = await findBestProducts({ type: 'keyword', value: keyword.trim() })
      setBestProducts(data.results)
      if (data.results.length === 0) setBestError('Aucun produit trouvé pour ce mot-clé.')
    } catch (err) {
      setBestError(err instanceof Error ? err.message : 'Erreur lors de la recherche')
    } finally {
      setBestLoading(false)
    }
  }

  async function handleAnalyzeCandidate(detailUrl: string) {
    if (!user) { navigate('/login'); return }
    if (!canAnalyze) { setShowUpgradeModal(true); return }
    await runAnalysis({ type: 'url', productUrl: detailUrl })
  }

  return (
    <>
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowUpgradeModal(false)}
          />
          <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
            <div className="rounded-3xl border-2 border-primary/30 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
              <div className="relative bg-gradient-to-br from-[#0A1B33] to-[#162B49] px-6 py-8 text-white text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full -translate-x-12 -translate-y-12" />
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full translate-x-8 translate-y-8" />
                <div className="absolute top-4 right-6">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative z-10">
                  <div className="h-16 w-16 rounded-2xl bg-primary/15 backdrop-blur grid place-items-center mx-auto mb-4 shadow-lg">
                    <Lock className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="font-serif text-2xl font-bold mb-2">Crédits gratuits épuisés</h2>
                  <p className="text-sm text-white/75 max-w-xs mx-auto leading-relaxed">
                    Vous avez utilisé vos 3 analyses gratuites. Passez à Pro pour des analyses illimitées.
                  </p>
                </div>
              </div>
              <div className="px-6 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-semibold">Plan Pro — Tout inclus</span>
                  <Badge className="ml-auto bg-primary/10 text-primary border-primary/20 text-xs rounded-full">Populaire</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {PRO_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-xs">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-primary/8 to-primary/3 border border-primary/15 p-4 mb-5 text-center">
                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-3xl font-bold font-serif text-primary">$9.90</span>
                    <span className="text-sm text-muted-foreground">/mois</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Soit moins de <span className="font-semibold text-foreground">$0.33/jour</span></p>
                </div>
                <div className="space-y-2.5">
                  <Button asChild className="w-full h-12 rounded-full text-base shadow-lg shadow-primary/20 gap-2">
                    <Link to="/app/billing"><Zap className="h-5 w-5" />Passer à Pro maintenant</Link>
                  </Button>
                  <Button variant="ghost" className="w-full h-10 rounded-full text-sm text-muted-foreground" onClick={() => setShowUpgradeModal(false)}>
                    Peut-être plus tard
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 text-center mt-4">🔒 Paiement sécurisé • Annulation à tout moment • Garantie 30 jours</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card className="tilt-card border-2 border-border shadow-xl shadow-primary/5">
        <CardContent className="p-6">
          {step === 'analyzing' ? (
            <div className="py-12 text-center">
              <div className="relative mb-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mx-auto">
                  <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-20 w-20 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              </div>
              <h3 className="font-serif font-semibold text-lg mb-2">Analyse en cours…</h3>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {mode === 'url' ? (
                  <>
                    <p>🔍 Extraction de l'ID produit</p>
                    <p>📦 Récupération des données via API</p>
                  </>
                ) : mode === 'image' ? (
                  <p>🖼️ Analyse visuelle de l'image</p>
                ) : (
                  <p>📦 Récupération des données du produit sélectionné</p>
                )}
                <p>🤖 Analyse IA en cours</p>
                <p>📊 Génération du rapport</p>
              </div>
              <p className="text-xs text-muted-foreground mt-4 mb-5">Cela peut prendre 15–30 secondes</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={handleCancelAnalysis}
              >
                <X className="h-3.5 w-3.5" />
                Annuler l'analyse
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode tabs */}
              <div className="flex rounded-xl bg-secondary/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => { setMode('url'); setError('') }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === 'url'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LinkIcon className="h-4 w-4" />
                  Lien produit
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('image'); setError('') }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === 'image'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ImagePlus className="h-4 w-4" />
                  Image produit
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('keyword'); setError('') }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    mode === 'keyword'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Award className="h-4 w-4" />
                  Meilleurs produits
                </button>
              </div>

              {/* URL input */}
              {mode === 'url' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    URL du produit
                  </label>
                  <Input
                    type="url"
                    placeholder="https://detail.1688.com/offer/... ou https://item.jd.com/..."
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
                    className="h-12 font-mono text-sm"
                    disabled={loading}
                  />
                  {urlError && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 flex-shrink-0" />{urlError}
                    </p>
                  )}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Supporté : 1688.com, Taobao, JD.com, Pinduoduo, Alibaba, AliExpress, e.tb.cn</span>
                  </div>

                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Exemples :</p>
                    <div className="space-y-1.5">
                      {EXAMPLE_URLS.map((u) => (
                        <div
                          key={u}
                          className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 text-xs font-mono text-muted-foreground cursor-pointer hover:bg-secondary transition-colors"
                          onClick={() => setUrl(u)}
                        >
                          <LinkIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{u}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Image input */}
              {mode === 'image' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                    Image du produit
                  </label>

                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden border-2 border-primary/20 bg-secondary/30">
                      <img
                        src={imagePreview}
                        alt="Aperçu produit"
                        className="w-full max-h-64 object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 text-white grid place-items-center transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="px-3 py-2 bg-secondary/80 text-xs text-muted-foreground flex items-center gap-2">
                        <FileImage className="h-3.5 w-3.5" />
                        <span className="truncate">{imageFile?.name}</span>
                        <span className="ml-auto shrink-0">{imageFile ? (imageFile.size / 1024 / 1024).toFixed(2) : 0} Mo</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      ref={dropZoneRef}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                        isDragging
                          ? 'border-primary bg-primary/5 scale-[1.01]'
                          : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                      }`}
                    >
                      <div className={`h-12 w-12 rounded-xl grid place-items-center transition-colors ${isDragging ? 'bg-primary/15' : 'bg-secondary'}`}>
                        <Upload className={`h-6 w-6 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {isDragging ? 'Déposez l\'image ici' : 'Glissez une image ou cliquez pour parcourir'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP, GIF — max {MAX_IMAGE_SIZE_MB} Mo</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES.join(',')}
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </div>
                  )}

                  {imageError && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 flex-shrink-0" />{imageError}
                    </p>
                  )}

                  {imagePreview && (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full gap-2 w-full"
                        onClick={handleImageSearch}
                        disabled={bestLoading}
                      >
                        {bestLoading ? (
                          <><div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />Recherche en cours…</>
                        ) : (
                          <><Award className="h-3.5 w-3.5" />Trouver les 3 meilleurs produits sur 1688</>
                        )}
                      </Button>

                      {bestError && (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 flex-shrink-0" />{bestError}
                        </p>
                      )}

                      {bestLoading && (
                        <div className="space-y-2">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
                          ))}
                        </div>
                      )}

                      {!bestLoading && bestProducts.length > 0 && (
                        <div className="space-y-3">
                          {bestProducts.map((p, i) => (
                            <BestProductCard key={p.offer_id} product={p} rank={i} onAnalyze={handleAnalyzeCandidate} disabled={loading} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    Recherche visuelle Pailitao (拍立淘) sur 1688 + analyse IA complète du produit.
                  </p>
                </div>
              )}

              {/* Keyword input — best-3 finder */}
              {mode === 'keyword' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    Que recherchez-vous ?
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Ex: sac à dos, montre connectée, chaussures de sport…"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleFindBest())}
                      className="h-12 text-sm flex-1"
                      disabled={bestLoading}
                    />
                    <Button
                      type="button"
                      onClick={handleFindBest}
                      disabled={bestLoading}
                      className="h-12 rounded-xl px-5 shrink-0"
                    >
                      {bestLoading ? (
                        <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    L'IA analyse les ventes, avis, note vendeur et ancienneté fournisseur pour ne garder que les 3 meilleurs produits sur 1688.
                  </p>

                  {bestError && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 flex-shrink-0" />{bestError}
                    </p>
                  )}

                  {bestLoading && (
                    <div className="space-y-2 pt-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {!bestLoading && bestProducts.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {bestProducts.map((p, i) => (
                        <BestProductCard key={p.offer_id} product={p} rank={i} onAnalyze={handleAnalyzeCandidate} disabled={loading} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {mode !== 'keyword' && (
                <Button
                  type="submit"
                  className="w-full h-12 rounded-full text-base shadow-lg shadow-primary/20"
                  disabled={loading}
                >
                  {!canAnalyze ? (
                    <><Lock className="h-5 w-5" />Débloquer l'analyse — Passer à Pro</>
                  ) : mode === 'url' ? (
                    <><Search className="h-5 w-5" />Analyser le lien</>
                  ) : (
                    <><Sparkles className="h-5 w-5" />Analyser l'image</>
                  )}
                </Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </>
  )
}
