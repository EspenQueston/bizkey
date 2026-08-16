import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Users, CreditCard, Zap, ShoppingCart, Truck,
  Tag, Settings, BarChart3, Activity, DollarSign, Search,
  Loader2, ArrowUpRight, Webhook, RefreshCw, Bell,
  CheckCircle2, AlertCircle, ChevronRight,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartEmpty } from '@/components/admin/ChartEmpty'
import { ACCENTS, type AccentName } from '@/lib/accentPalette'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAdminStats, getAllPlans, getAllUsers, getAllTransactions,
  getAllPromoCodes, getERPOrders, getERPDeliveries,
} from '@/lib/db'
import type { Plan, PaymentTransaction, PromoCode } from '@/lib/supabase'
import type { ERPOrder, ERPDelivery } from '@/lib/supabase'

// ─── Metric card ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.FC<{ className?: string }>
  accent: AccentName
  trend?: 'up' | 'down' | 'neutral'
  to: string
}

function MetricCard({ title, value, sub, icon: Icon, accent, trend, to }: MetricCardProps) {
  const a = ACCENTS[accent]
  return (
    <Link to={to} className="group">
      <Card className={`relative overflow-hidden border-border ${a.ring} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full`}>
        {/* Colour-coded top rule + tinted wash give each metric its own identity */}
        <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
        <span className={`absolute inset-0 bg-gradient-to-br ${a.wash} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        <CardContent className="p-5 relative">
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2.5 rounded-xl ${a.gradient} ${a.glow} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
            {trend === 'down' && <TrendingUp className="h-4 w-4 text-rose-500 rotate-180" />}
            {trend === 'neutral' && <Activity className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className={`text-2xl font-bold font-serif tracking-tight ${a.text}`}>{value}</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sub}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-2 group-hover:text-foreground transition-colors flex items-center gap-1">
            {title} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Progress bar row ─────────────────────────────────────────────────────────
function ProgressRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value.toLocaleString('fr-FR')}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
// Saturated gradients read as status "lights" at a glance, which pale tints
// never quite manage in a dense transaction list.
//
// These carry white TEXT, so the stops start at the 600/700 range: the 400-level
// stops used on icon tiles only reach ~1.7:1 against white, well under the 4.5:1
// WCAG needs for small text. Icons elsewhere can stay brighter; words cannot.
const TX_STATUS: Record<string, string> = {
  pending:  'bg-gradient-to-r from-amber-700 to-orange-600 text-white border-transparent',
  success:  'bg-gradient-to-r from-emerald-700 to-teal-600 text-white border-transparent',
  failed:   'bg-gradient-to-r from-rose-700 to-red-600 text-white border-transparent',
  refunded: 'bg-gradient-to-r from-blue-700 to-sky-600 text-white border-transparent',
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function ERPPanelDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [adminStats, setAdminStats] = useState<Awaited<ReturnType<typeof getAdminStats>> | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [users, setUsers] = useState<{ id: string; email: string; name: string | null; is_admin: boolean; created_at: string }[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [orders, setOrders] = useState<ERPOrder[]>([])
  const [deliveries, setDeliveries] = useState<ERPDelivery[]>([])

  async function loadAll() {
    if (!user) return
    setRefreshing(true)
    await Promise.allSettled([
      getAdminStats().then(setAdminStats).catch(console.warn),
      getAllPlans().then(setPlans).catch(console.warn),
      getAllUsers().then(v => setUsers(v as typeof users)).catch(console.warn),
      getAllTransactions().then(setTransactions).catch(console.warn),
      getAllPromoCodes().then(setPromos).catch(console.warn),
      getERPOrders(user.id).then(setOrders).catch(console.warn),
      getERPDeliveries(user.id).then(setDeliveries).catch(console.warn),
    ])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadAll() }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement du tableau de bord…</p>
        </div>
      </div>
    )
  }

  // Derived values
  const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'draft'].includes(o.status)).length
  const inTransit = deliveries.filter(d => ['in_transit', 'customs', 'dispatched'].includes(d.status)).length
  const pendingTx = transactions.filter(t => t.status === 'pending').length
  const successTx = transactions.filter(t => t.status === 'success').length
  const recentTx = transactions.slice(0, 8)
  const alerts = adminStats?.highSeverityAlerts ?? []
  const hasRequestData = (adminStats?.requestsByDay ?? []).some(d => (d.basic ?? 0) + (d.advanced ?? 0) > 0)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg shadow-blue-500/40 grid place-items-center">
              <Activity className="h-5 w-5 text-white" />
            </span>
            Tableau de bord
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Données en temps réel — BizKey
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {alerts.length > 0 && (
            <Badge variant="destructive" className="gap-1.5 rounded-full">
              <Bell className="h-3 w-3" />
              {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="secondary" className="rounded-full gap-1.5 hidden sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En ligne
          </Badge>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing} className="rounded-full h-8 px-3">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ── Alerts — consolidated into one card instead of stacked full-width bars ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive mb-2">
            <Bell className="h-4 w-4" />
            {alerts.length} alerte{alerts.length > 1 ? 's' : ''} opérationnelle{alerts.length > 1 ? 's' : ''}
          </div>
          <ul className="space-y-1.5">
            {alerts.map((alert, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive/90">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Croissance & revenus ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-700" />
          Croissance & revenus
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Revenus mensuels"
            accent="sapphire"
            value={`$${(adminStats?.mrr ?? 0).toFixed(2)}`}
            sub={`${successTx} transactions réussies`}
            icon={DollarSign}
            trend="up"
            to="/app/analytics"
          />
          <MetricCard
            title="Revenu total"
            accent="indigo"
            value={`$${(adminStats?.totalRevenue ?? 0).toFixed(2)}`}
            sub={`Taux échec paiement : ${adminStats?.paymentFailureRate ?? 0}%`}
            icon={TrendingUp}
            trend="up"
            to="/app/transactions"
          />
          <MetricCard
            title="Utilisateurs"
            accent="sky"
            value={users.length.toLocaleString('fr-FR')}
            sub={`${users.filter(u => u.is_admin).length} admins · ${adminStats?.activeSubs ?? 0} abonnés`}
            icon={Users}
            trend="up"
            to="/app/users"
          />
          <MetricCard
            title="Analyses (30j)"
            accent="violet"
            value={adminStats?.analyses30d ?? 0}
            sub={`${users.length} compte${users.length > 1 ? 's' : ''} au total`}
            icon={Search}
            trend="neutral"
            to="/app/analyses"
          />
        </div>
      </div>

      {/* ── Utilisation & qualité IA ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
          Utilisation & qualité IA
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Requêtes (mois)"
            accent="amber"
            value={(adminStats?.totalRequests ?? 0).toLocaleString('fr-FR')}
            sub={`${adminStats?.basicRequests ?? 0} Basic · ${adminStats?.advancedRequests ?? 0} Advanced`}
            icon={Zap}
            trend="up"
            to="/app/analytics"
          />
          <MetricCard
            title="Taux fallback IA"
            accent="rose"
            value={`${adminStats?.fallbackRate ?? 0}%`}
            sub={(adminStats?.fallbackRate ?? 0) >= 40 ? 'Au-dessus du seuil recommandé' : 'Dans la norme'}
            icon={Activity}
            trend={(adminStats?.fallbackRate ?? 0) >= 40 ? 'down' : 'up'}
            to="/app/ai-quality"
          />
          <MetricCard
            title="Codes Promo"
            accent="rose"
            value={promos.filter(p => p.is_active).length}
            sub={`${promos.length} total créés`}
            icon={Tag}
            trend="neutral"
            to="/app/promo"
          />
          <MetricCard
            title="Latence moyenne"
            accent="teal"
            value={`${adminStats?.avgLatencyMs ?? 0}ms`}
            sub={(adminStats?.serverErrorRate ?? 0) >= 10 ? `${adminStats?.serverErrorRate}% d'erreurs serveur` : 'Serveur stable'}
            icon={Activity}
            trend={(adminStats?.serverErrorRate ?? 0) >= 10 ? 'down' : 'up'}
            to="/app/analytics"
          />
        </div>
      </div>

      {/* ── Opérations ERP ── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-sky-400 to-indigo-600" />
          Opérations ERP
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <MetricCard
            title="Commandes ERP"
            accent="amber"
            value={orders.length}
            sub={`${activeOrders} en cours · ${inTransit} en transit`}
            icon={ShoppingCart}
            trend="neutral"
            to="/app/orders"
          />
          <MetricCard
            title="Paiements en attente"
            accent="rose"
            value={pendingTx}
            sub={pendingTx > 0 ? 'À vérifier avec le fournisseur' : 'Tout est traité'}
            icon={Webhook}
            trend={pendingTx > 0 ? 'down' : 'up'}
            to="/app/transactions"
          />
        </div>
      </div>

      {/* ── Requests trend chart ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Requêtes — 30 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasRequestData ? (
            <ChartEmpty
              icon={Zap}
              title="Aucune requête sur les 30 derniers jours"
              hint="La courbe se remplira dès les premières analyses."
              height={200}
            />
          ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={adminStats?.requestsByDay ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="erpBasicFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="erpAdvancedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="basic" name="Basic" stackId="1" stroke="var(--chart-1)" fill="url(#erpBasicFill)" />
              <Area type="monotone" dataKey="advanced" name="Advanced" stackId="1" stroke="var(--chart-3)" fill="url(#erpAdvancedFill)" />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Main content grid (2/3 + 1/3 like dashboard1) ── */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Recent transactions — 2/3 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Transactions récentes
                </CardTitle>
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs rounded-full gap-1">
                  <Link to="/app/transactions">
                    Voir tout <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <CardDescription>Derniers paiements enregistrés</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {recentTx.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                  <CreditCard className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Aucune transaction</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTx.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                          tx.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                          tx.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                          'bg-red-50 dark:bg-red-900/20'
                        }`}>
                          <DollarSign className={`h-4 w-4 ${
                            tx.status === 'success' ? 'text-emerald-600' :
                            tx.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 10)}…</span>
                            <Badge className={`text-[10px] px-1.5 py-0 h-4 ${TX_STATUS[tx.status] ?? ''}`}>
                              {tx.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize hidden sm:inline">{tx.gateway}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {tx.phone_number ?? '—'} · {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-semibold text-sm">{tx.amount_local.toLocaleString('fr-FR')} {tx.currency}</div>
                        {tx.amount_usd && <div className="text-xs text-muted-foreground">${tx.amount_usd.toFixed(2)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {recentTx.length > 0 && (
              <CardFooter className="pt-3 text-xs text-muted-foreground border-t border-border">
                Affichage des {recentTx.length} transactions les plus récentes
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Right column — 1/3 */}
        <div className="space-y-5">

          {/* Usage stats (like dashboard1 Quick Stats) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Utilisation (mois)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminStats ? (
                <>
                  <ProgressRow
                    label="Requêtes Basic"
                    value={adminStats.basicRequests}
                    max={adminStats.totalRequests || 1}
                    color="bg-gradient-to-r from-sky-400 to-blue-600"
                  />
                  <ProgressRow
                    label="Requêtes Advanced"
                    value={adminStats.advancedRequests}
                    max={adminStats.totalRequests || 1}
                    color="bg-gradient-to-r from-violet-400 to-purple-600"
                  />
                  <ProgressRow
                    label="Taux fallback IA"
                    value={adminStats.fallbackRate}
                    max={100}
                    color={adminStats.fallbackRate > 40 ? 'bg-gradient-to-r from-rose-400 to-red-600' : 'bg-gradient-to-r from-amber-400 to-orange-500'}
                  />
                  <ProgressRow
                    label="Taux erreurs serveur"
                    value={adminStats.serverErrorRate}
                    max={100}
                    color={adminStats.serverErrorRate > 10 ? 'bg-gradient-to-r from-rose-400 to-red-600' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Données indisponibles</p>
              )}
            </CardContent>
          </Card>

          {/* System status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                État du système
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: 'Paiements',
                  ok: (adminStats?.paymentFailureRate ?? 0) < 20,
                  detail: `${adminStats?.paymentFailureRate ?? 0}% d'échec`,
                },
                {
                  label: 'Serveur API',
                  ok: (adminStats?.serverErrorRate ?? 0) < 10,
                  detail: `${adminStats?.avgLatencyMs ?? 0}ms latence moy.`,
                },
                {
                  label: 'IA (OpenRouter)',
                  ok: (adminStats?.fallbackRate ?? 0) < 40,
                  detail: `${adminStats?.fallbackRate ?? 0}% fallback`,
                },
                {
                  label: 'Abonnements',
                  ok: (adminStats?.activeSubs ?? 0) >= 0,
                  detail: `${adminStats?.activeSubs ?? 0} actifs`,
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    {item.ok
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <AlertCircle className="h-4 w-4 text-destructive" />
                    }
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick actions (like dashboard1 bottom section) ── */}
      <Card className="border-dashed border-2">
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-4">
            Actions rapides
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              { icon: Search,       label: 'Analyses',     to: '/app/analyses',   accent: 'violet'  },
              { icon: Users,        label: 'Utilisateurs', to: '/app/users',      accent: 'sky'     },
              { icon: Tag,          label: 'Codes Promo',  to: '/app/promo',      accent: 'rose'    },
              { icon: ShoppingCart, label: 'Commandes',    to: '/app/orders',     accent: 'amber'   },
              { icon: Truck,        label: 'Livraisons',   to: '/app/delivery',   accent: 'indigo'  },
              { icon: BarChart3,    label: 'Analytiques',  to: '/app/analytics',  accent: 'sapphire' },
            ] as const).map(action => {
              const a = ACCENTS[action.accent]
              return (
                <Button key={action.label} asChild variant="outline"
                  className={`group/qa h-auto py-3.5 flex-col gap-2 rounded-xl ${a.ring} hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-xs font-medium`}>
                  <Link to={action.to}>
                    <div className={`h-9 w-9 rounded-xl ${a.gradient} ${a.glow} grid place-items-center transition-transform duration-300 group-hover/qa:scale-110 group-hover/qa:-rotate-6`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    {action.label}
                  </Link>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
