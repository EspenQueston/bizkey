import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Loader2, ExternalLink, Users, User as UserIcon,
  ShieldCheck, Zap, AlertTriangle, TrendingUp, Coins, Download,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChartEmpty } from '@/components/admin/ChartEmpty'
import { useAuth } from '@/contexts/AuthContext'
import { getAllAnalysesForAdmin, type AdminAnalysisRow } from '@/lib/db'
import { ACCENTS, type AccentName } from '@/lib/accentPalette'
import { toast } from 'sonner'

type Scope = 'mine' | 'all'
type QualityFilter = 'all' | 'high' | 'degraded'

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  onebound:    { label: 'Données vérifiées', cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  ai_estimate: { label: 'Estimation IA',      cls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25' },
  fallback:    { label: 'Données limitées',   cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/25' },
}

function sourceBadge(source: string | null) {
  const meta = SOURCE_META[source ?? ''] ?? { label: source ?? 'Inconnu', cls: 'bg-muted text-muted-foreground border-border' }
  return <Badge variant="outline" className={`text-[10px] rounded-full ${meta.cls}`}>{meta.label}</Badge>
}

function StatTile({ icon: Icon, label, value, sub, accent, tone }: {
  icon: React.FC<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  accent: AccentName
  /** Overrides the accent when the value itself carries a verdict. */
  tone?: 'warn' | 'good'
}) {
  const a = ACCENTS[accent]
  const valueCls =
    tone === 'warn' ? 'text-rose-600 dark:text-rose-400'
    : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400'
    : a.text
  return (
    <Card className={`group relative overflow-hidden ${a.ring} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
      <span className={`absolute inset-0 bg-gradient-to-br ${a.wash} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <CardContent className="p-4 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-7 w-7 rounded-lg ${a.gradient} ${a.glow} grid place-items-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${valueCls}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminAnalyses() {
  const { user } = useAuth()
  const [rows, setRows] = useState<AdminAnalysisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<Scope>('all')
  const [search, setSearch] = useState('')
  const [quality, setQuality] = useState<QualityFilter>('all')

  useEffect(() => {
    getAllAnalysesForAdmin()
      .then(setRows)
      .catch(err => {
        console.warn('AdminAnalyses load error:', err)
        toast.error("Impossible de charger les analyses")
      })
      .finally(() => setLoading(false))
  }, [])

  const scoped = useMemo(
    () => (scope === 'mine' ? rows.filter(r => r.user_id === user?.id) : rows),
    [rows, scope, user?.id],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped.filter(r => {
      const matchQ = !q
        || (r.product_name ?? '').toLowerCase().includes(q)
        || r.user_email.toLowerCase().includes(q)
        || (r.supplier_name ?? '').toLowerCase().includes(q)
      const degraded = r.data_source === 'fallback' || r.ai_source === 'fallback'
      const matchQuality =
        quality === 'all' ? true : quality === 'degraded' ? degraded : !degraded
      return matchQ && matchQuality
    })
  }, [scoped, search, quality])

  // Insights are computed on the *scoped* set so they always describe what the
  // switch is currently showing, not the unfiltered table.
  const stats = useMemo(() => {
    const total = scoped.length
    const degraded = scoped.filter(r => r.data_source === 'fallback' || r.ai_source === 'fallback').length
    const credits = scoped.reduce((s, r) => s + r.credits_consumed, 0)
    const scored = scoped.filter(r => typeof r.confidence_score === 'number')
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, r) => s + (r.confidence_score ?? 0), 0) / scored.length)
      : 0
    const uniqueUsers = new Set(scoped.map(r => r.user_id)).size
    return {
      total, degraded, credits, avgScore, uniqueUsers,
      degradedPct: total ? Math.round((degraded / total) * 100) : 0,
    }
  }, [scoped])

  function exportCsv() {
    const header = ['Date', 'Utilisateur', 'Produit', 'Fournisseur', 'Prix', 'Score', 'Source', 'Crédits']
    const lines = filtered.map(r => [
      new Date(r.created_at).toLocaleString('fr-FR'),
      r.user_email,
      (r.product_name ?? '').replace(/[";]/g, ' '),
      (r.supplier_name ?? '').replace(/[";]/g, ' '),
      r.price ?? '',
      r.confidence_score ?? '',
      r.data_source ?? '',
      r.credits_consumed,
    ].join(';'))
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analyses-${scope}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement des analyses…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + scope switch */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg shadow-blue-500/40 grid place-items-center">
              <Search className="h-5 w-5 text-white" />
            </span>
            Analyses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {scope === 'all'
              ? "Historique complet de la plateforme, tous comptes confondus"
              : "Vos propres analyses uniquement"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented scope switch */}
          <div className="inline-flex p-1 rounded-full bg-muted border border-border">
            <button
              onClick={() => setScope('mine')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                scope === 'mine'
                  ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-600/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserIcon className="h-3.5 w-3.5" />
              Mes analyses
            </button>
            <button
              onClick={() => setScope('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                scope === 'all'
                  ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-600/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Tous les utilisateurs
            </button>
          </div>

          <Button variant="outline" size="sm" className="rounded-full h-9" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Insight tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile accent="sapphire" icon={Search} label="Analyses" value={stats.total} sub={scope === 'all' ? 'sur la plateforme' : 'par vous'} />
        <StatTile accent="sky" icon={Users} label="Comptes actifs" value={stats.uniqueUsers} sub="ayant analysé" />
        <StatTile accent="violet" icon={TrendingUp} label="Score moyen" value={stats.avgScore || '—'} sub="confiance /100" />
        <StatTile accent="amber" icon={Coins} label="Crédits consommés" value={stats.credits} sub="cumulés" />
        <StatTile
          accent="rose"
          icon={AlertTriangle}
          label="Données dégradées"
          value={`${stats.degradedPct}%`}
          sub={`${stats.degraded} analyse${stats.degraded > 1 ? 's' : ''}`}
          tone={stats.degradedPct > 40 ? 'warn' : 'good'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher produit, fournisseur ou email…"
            className="pl-9 h-10"
          />
        </div>
        {([
          { key: 'all', label: 'Toutes' },
          { key: 'high', label: 'Données réelles' },
          { key: 'degraded', label: 'Dégradées' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setQuality(f.key)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-200 ${
              quality === f.key
                ? 'bg-gradient-to-r from-blue-700 to-blue-600 text-white border-transparent shadow-md shadow-blue-600/30'
                : 'border-border text-muted-foreground hover:border-blue-500/50 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <ChartEmpty
          icon={Search}
          title={scoped.length === 0 ? 'Aucune analyse pour ce périmètre' : 'Aucun résultat pour ce filtre'}
          hint={scoped.length === 0
            ? "Les analyses apparaîtront ici dès qu'un utilisateur en lancera une."
            : 'Ajustez la recherche ou le filtre de qualité.'}
          height={240}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Produit', 'Utilisateur', 'Score', 'Prix', 'Source', 'Crédits', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(r => {
                    const score = r.confidence_score ?? 0
                    const scoreCls = score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
                      : score >= 50 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-destructive'
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 max-w-64">
                          <div className="font-medium truncate">{r.product_name ?? 'Produit analysé'}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.supplier_name ?? '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium truncate max-w-48">{r.user_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-48">{r.user_email}</div>
                        </td>
                        <td className={`px-4 py-3 font-bold tabular-nums ${scoreCls}`}>
                          {r.confidence_score != null ? `${score}` : '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                          {r.price ? `¥${r.price}` : '—'}
                        </td>
                        <td className="px-4 py-3">{sourceBadge(r.data_source)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs tabular-nums">
                            <Zap className="h-3 w-3 text-yellow-500" />
                            {r.credits_consumed}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Button asChild size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Link to={`/app/analysis/${r.id}`} title="Ouvrir l'analyse">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        {filtered.length} analyse{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
        {scope === 'all' && ' — vue administrateur, tous comptes confondus'}
      </p>
    </div>
  )
}
