import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, BarChart3, TrendingUp, Users, Zap, Loader2, UserPlus, ShieldCheck } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HealthStat } from '@/components/admin/HealthStat'
import { ChartEmpty } from '@/components/admin/ChartEmpty'
import { ACCENTS } from '@/lib/accentPalette'
import { getAdminStats } from '@/lib/db'
import { supabase } from '@/lib/supabase'

interface MonthlyRevenue {
  month: string
  amount: number
}

const QUALITY_COLORS: Record<string, string> = {
  high: 'var(--chart-1)',
  medium: 'var(--chart-3)',
  low: '#f59e0b',
  inconnu: '#94a3b8',
}

function tooltipStyle() {
  return {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    fontSize: '12px',
    padding: '8px 12px',
  }
}

export default function AdminAnalytics() {
  const { t } = useTranslation('adminAnalytics')
  const QUALITY_LABELS: Record<string, string> = {
    high: t('qualityChart.high'),
    medium: t('qualityChart.medium'),
    low: t('qualityChart.low'),
    inconnu: t('qualityChart.unknown'),
  }
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdminStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [s, txRes] = await Promise.all([
          getAdminStats(),
          supabase
            .from('payment_transactions')
            .select('amount_usd, created_at')
            .eq('status', 'success')
            .order('created_at', { ascending: true }),
        ])
        setStats(s)

        // Group by month
        const map: Record<string, number> = {}
        for (const tx of txRes.data ?? []) {
          const key = new Date(tx.created_at).toLocaleDateString('fr', { month: 'short', year: 'numeric' })
          map[key] = (map[key] ?? 0) + (tx.amount_usd ?? 0)
        }
        setMonthlyRevenue(Object.entries(map).map(([month, amount]) => ({ month, amount })).slice(-6))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const alerts = stats?.highSeverityAlerts ?? []
  const totalSignups30d = (stats?.signupsByDay ?? []).reduce((sum, d) => sum + d.count, 0)
  const hasRequestData = (stats?.requestsByDay ?? []).some(d => (d.basic ?? 0) + (d.advanced ?? 0) > 0)
  const hasSignupData = totalSignups30d > 0
  const qualityBreakdown = stats?.qualityBreakdown ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { accent: 'sapphire', icon: TrendingUp, label: t('metrics.mrr'), value: `$${stats?.mrr.toFixed(2) ?? '—'}` },
          { accent: 'sky',     icon: Users,      label: t('metrics.activeSubs'),  value: stats?.activeSubs ?? '—' },
          { accent: 'amber',   icon: Zap,        label: t('metrics.requests'),     value: stats?.totalRequests ?? '—',
            sub: `${stats?.basicRequests ?? 0} Basic · ${stats?.advancedRequests ?? 0} Advanced` },
          { accent: 'violet',  icon: UserPlus,   label: t('metrics.newAccounts'), value: totalSignups30d },
        ] as const).map(m => {
          const a = ACCENTS[m.accent]
          return (
            <Card key={m.label} className={`group relative overflow-hidden ${a.ring} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
              <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
              <span className={`absolute inset-0 bg-gradient-to-br ${a.wash} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <CardContent className="p-5 relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-8 w-8 rounded-lg ${a.gradient} ${a.glow} grid place-items-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                    <m.icon className="h-4 w-4 text-white" />
                  </span>
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                </div>
                <div className={`text-2xl font-bold ${a.text}`}>{m.value}</div>
                {'sub' in m && m.sub && <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthStat
          label={t('health.fallbackRate')}
          value={stats?.fallbackRate ?? 0}
          unit="%"
          threshold={40}
          hint={t('health.fallbackHint')}
        />
        <HealthStat
          label={t('health.paymentFailure')}
          value={stats?.paymentFailureRate ?? 0}
          unit="%"
          threshold={20}
          hint={t('health.paymentFailureHint')}
        />
        <HealthStat
          label={t('health.avgLatency')}
          value={stats?.avgLatencyMs ?? 0}
          unit=" ms"
          threshold={3000}
          hint={t('health.avgLatencyHint')}
        />
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-900/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t('alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <p key={alert} className="text-sm text-amber-700 dark:text-amber-300">• {alert}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('revenueChart.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyRevenue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('revenueChart.empty')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(v: number) => [`$${v.toFixed(2)}`, t('revenueChart.revenue')]} />
                <Bar dataKey="amount" name={t('revenueChart.revenue')} fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Requests trend + quality breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {t('requestsChart.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasRequestData ? (
              <ChartEmpty
                icon={Zap}
                title={t('requestsChart.emptyTitle')}
                hint={t('requestsChart.emptyHint')}
              />
            ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats?.requestsByDay ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="basicFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="advancedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="basic" name="Basic" stackId="1" stroke="var(--chart-1)" fill="url(#basicFill)" />
                <Area type="monotone" dataKey="advanced" name="Advanced" stackId="1" stroke="var(--chart-3)" fill="url(#advancedFill)" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t('qualityChart.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qualityBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={qualityBreakdown} dataKey="count" nameKey="tier" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {qualityBreakdown.map((q) => (
                      <Cell key={q.tier} fill={QUALITY_COLORS[q.tier] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle()} formatter={(v: number, _n, p) => [v, QUALITY_LABELS[p?.payload?.tier as string] ?? p?.payload?.tier]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">{t('qualityChart.empty')}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-1 justify-center">
              {qualityBreakdown.map((q) => (
                <span key={q.tier} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: QUALITY_COLORS[q.tier] ?? '#94a3b8' }} />
                  {QUALITY_LABELS[q.tier] ?? q.tier} ({q.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signups trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            {t('signupsChart.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasSignupData ? (
            <ChartEmpty
              icon={UserPlus}
              title={t('signupsChart.emptyTitle')}
              hint={t('signupsChart.emptyHint')}
            />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats?.signupsByDay ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Bar dataKey="count" name={t('signupsChart.signups')} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
