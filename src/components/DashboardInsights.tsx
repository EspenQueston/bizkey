import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, PieChart as PieChartIcon, Activity, Star } from 'lucide-react'
import type { Database } from '@/lib/supabase'

type Analysis = Database['public']['Tables']['analyses']['Row']

const PLATFORM_LABELS: Record<string, string> = {
  '1688': '1688.com',
  taobao: 'Taobao',
  tmall: 'Tmall',
  alibaba: 'Alibaba',
  aliexpress: 'AliExpress',
  jd: 'JD.com',
  pinduoduo: 'Pinduoduo',
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', '#94a3b8']

function tooltipStyle() {
  return {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    fontSize: '12px',
    padding: '8px 12px',
  }
}

export function DashboardInsights({ analyses }: { analyses: Analysis[] }) {
  const trend = useMemo(() => {
    const days = 14
    const buckets = new Map<string, number>()
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      buckets.set(key, 0)
    }
    for (const a of analyses) {
      const d = new Date(a.created_at)
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
      if (diffDays < 0 || diffDays >= days) continue
      const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
  }, [analyses])

  const scoreBuckets = useMemo(() => {
    const buckets = [
      { label: '0-40', min: 0, max: 40, count: 0 },
      { label: '40-60', min: 40, max: 60, count: 0 },
      { label: '60-80', min: 60, max: 80, count: 0 },
      { label: '80-100', min: 80, max: 101, count: 0 },
    ]
    for (const a of analyses) {
      const score = a.confidence_score ?? 0
      const bucket = buckets.find((b) => score >= b.min && score < b.max)
      if (bucket) bucket.count++
    }
    return buckets
  }, [analyses])

  const platformBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of analyses) {
      const platform = a.raw_product_data?.platform ?? 'autre'
      const label = PLATFORM_LABELS[platform] ?? platform
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [analyses])

  const avgRating = useMemo(() => {
    const rated = analyses.filter((a) => a.raw_product_data?.rating != null && a.raw_product_data.rating > 0)
    if (rated.length === 0) return null
    return rated.reduce((sum, a) => sum + (a.raw_product_data!.rating ?? 0), 0) / rated.length
  }, [analyses])

  const verifiedRate = useMemo(() => {
    if (analyses.length === 0) return 0
    const verified = analyses.filter((a) => a.data_source === 'onebound').length
    return Math.round((verified / analyses.length) * 100)
  }, [analyses])

  if (analyses.length === 0) return null

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activité — 14 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle()} labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }} />
              <Area type="monotone" dataKey="count" name="Analyses" stroke="var(--primary)" strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            Plateformes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {platformBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={platformBreakdown} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {platformBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle()} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] grid place-items-center text-xs text-muted-foreground">Pas de données</div>
          )}
          <div className="flex flex-wrap gap-2 mt-1 justify-center">
            {platformBreakdown.map((p, i) => (
              <span key={p.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                {p.name} ({p.value})
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Répartition des scores
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-4">
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={scoreBuckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: 'var(--secondary)' }} />
              <Bar dataKey="count" name="Analyses" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Qualité des données
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-secondary/40 border border-border text-center">
            <div className="text-2xl font-bold font-serif">{avgRating != null ? `${avgRating.toFixed(1)}/5` : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">Note vendeur moyenne (données réelles)</p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/40 border border-border text-center">
            <div className="text-2xl font-bold font-serif text-primary">{verifiedRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Analyses avec données vérifiées Onebound</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
