import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, MessageCircle, Bot, UserRound, Sparkles, ArrowRightLeft,
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { DASHBOARD_ACCENTS, type AccentName } from '@/lib/accentPalette'
import { useAuth } from '@/contexts/AuthContext'
import {
  getWhatsAppConversations, getWhatsAppMessagesForAnalytics,
  getUsageSummary, getConversationCountSince, getHandoffTicketsCountSince,
} from '@/lib/db'
import { CUSTOMER_AI_COST_MULTIPLIER } from '@/lib/whatsapp'
import type { WhatsAppConversation, WhatsAppMessage } from '@/lib/supabase'

interface MetricCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.FC<{ className?: string }>
  accent: AccentName
}

function MetricCard({ title, value, sub, icon: Icon, accent }: MetricCardProps) {
  const a = DASHBOARD_ACCENTS[accent]
  return (
    <Card className={`relative overflow-hidden border-border ${a.ring} hover:shadow-lg transition-all duration-300`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
      <CardContent className="p-5">
        <div className={`h-9 w-9 rounded-xl ${a.gradient} ${a.glow} grid place-items-center mb-3`}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <div className={`text-2xl font-bold font-serif tracking-tight ${a.text}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-2">{title}</p>
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, subtitle, icon: Icon, children }: {
  title: string
  subtitle?: string
  icon: React.FC<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-primary/10 grid place-items-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)']

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  pending_human: 'Transfert humain',
  closed: 'Fermée',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs space-y-0.5">
      {label && <p className="font-medium mb-1">{label}</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function DonutMini({ data }: { data: { name: string; value: number }[] }) {
  if (data.every(d => d.value === 0)) {
    return <div className="h-[180px] grid place-items-center text-xs text-muted-foreground">Pas encore de données</div>
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={66} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" height={28} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function AssistantAnalyticsPage() {
  const { profile, assistantClient } = useAuth()
  const isAdmin = profile?.is_admin === true
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [conversationsThisMonth, setConversationsThisMonth] = useState(0)
  const [aiCostThisMonth, setAiCostThisMonth] = useState(0)
  const [ticketsThisMonth, setTicketsThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAdmin && !assistantClient) { setLoading(false); return }
    const clientId = assistantClient?.id ?? null
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    Promise.allSettled([
      getWhatsAppConversations(),
      getWhatsAppMessagesForAnalytics(1000),
      getConversationCountSince(clientId, startOfMonth),
      getUsageSummary(clientId, startOfMonth),
      getHandoffTicketsCountSince(clientId, startOfMonth),
    ]).then(([conv, msgs, convoCount, usage, tickets]) => {
      if (conv.status === 'fulfilled') setConversations(conv.value)
      if (msgs.status === 'fulfilled') setMessages(msgs.value)
      if (convoCount.status === 'fulfilled') setConversationsThisMonth(convoCount.value)
      if (usage.status === 'fulfilled') setAiCostThisMonth(usage.value.reduce((sum, u) => sum + u.total_cost, 0))
      if (tickets.status === 'fulfilled') setTicketsThisMonth(tickets.value)
    }).finally(() => setLoading(false))
  }, [isAdmin, assistantClient])

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { open: 0, pending_human: 0, closed: 0 }
    for (const c of conversations) counts[c.status] = (counts[c.status] ?? 0) + 1
    return Object.entries(counts).map(([status, value]) => ({ name: STATUS_LABELS[status] ?? status, value }))
  }, [conversations])

  const replySplit = useMemo(() => {
    let bot = 0, agent = 0
    for (const m of messages) {
      if (m.direction !== 'outbound') continue
      if (m.sender_type === 'bot') bot += 1
      else if (m.sender_type === 'agent') agent += 1
    }
    return [{ name: 'IA', value: bot }, { name: 'Humain', value: agent }]
  }, [messages])

  const dailyVolume = useMemo(() => {
    const days: { key: string; label: string; entrants: number; sortants: number }[] = []
    const byKey = new Map<string, { entrants: number; sortants: number }>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      days.push({ key, label, entrants: 0, sortants: 0 })
      byKey.set(key, { entrants: 0, sortants: 0 })
    }
    for (const m of messages) {
      const key = m.created_at.slice(0, 10)
      const bucket = byKey.get(key)
      if (!bucket) continue
      if (m.direction === 'inbound') bucket.entrants += 1
      else bucket.sortants += 1
    }
    return days.map(d => ({ ...d, ...byKey.get(d.key)! }))
  }, [messages])

  const transferRate = conversationsThisMonth > 0 ? Math.round((ticketsThisMonth / conversationsThisMonth) * 100) : 0
  const inboundCount = messages.filter(m => m.direction === 'inbound').length
  const outboundCount = messages.filter(m => m.direction === 'outbound').length

  if (isAdmin && !assistantClient) {
    return (
      <div className="p-6">
        <div className="py-16 text-center max-w-md mx-auto">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Vue par entreprise</p>
          <p className="text-xs text-muted-foreground mt-1">
            Les statistiques sont propres à chaque entreprise cliente — consultez « Clients Assistant » pour la vue d'ensemble multi-entreprises.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Statistiques</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble de l'activité WhatsApp — {assistantClient?.company_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Conversations ce mois" value={conversationsThisMonth.toLocaleString('fr-FR')} sub={`${conversations.length} au total`} icon={MessageCircle} accent="sapphire" />
        <MetricCard title="Messages (30 derniers jours)" value={(inboundCount + outboundCount).toLocaleString('fr-FR')} sub={`${inboundCount} reçus · ${outboundCount} envoyés`} icon={ArrowRightLeft} accent="sky" />
        <MetricCard title="Coût IA ce mois" value={`$${(aiCostThisMonth * CUSTOMER_AI_COST_MULTIPLIER).toFixed(2)}`} sub="Consommation OpenAI facturée" icon={Sparkles} accent="amber" />
        <MetricCard title="Taux de transfert humain" value={`${transferRate}%`} sub={`${ticketsThisMonth} transfert${ticketsThisMonth !== 1 ? 's' : ''} ce mois`} icon={UserRound} accent="rose" />
      </div>

      <ChartCard title="Volume de messages" subtitle="14 derniers jours" icon={ArrowRightLeft}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyVolume} margin={{ left: -20, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="entrants" name="Reçus" stroke="var(--chart-1)" fill="url(#gradIn)" strokeWidth={2} />
            <Area type="monotone" dataKey="sortants" name="Envoyés" stroke="var(--chart-4)" fill="url(#gradOut)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title="Statut des conversations" icon={MessageCircle}>
          <DonutMini data={statusBreakdown} />
        </ChartCard>
        <ChartCard title="Réponses : IA vs humain" subtitle="Sur les messages envoyés" icon={Bot}>
          <DonutMini data={replySplit} />
        </ChartCard>
      </div>
    </div>
  )
}
