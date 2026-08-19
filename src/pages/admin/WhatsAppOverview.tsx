import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle, Smartphone, Bot, UserRound, BookOpen, Loader2, ChevronRight,
  Globe, Clock, TrendingUp, Sparkles, Building2,
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DASHBOARD_ACCENTS, type AccentName } from '@/lib/accentPalette'
import {
  getWhatsAppNumbers, getWhatsAppConversations, getWhatsAppMessagesForAnalytics,
  getWhatsAppKbArticles, getWhatsAppAutoReplies, getUsageSummaryAllTenants,
} from '@/lib/db'
import type { WhatsAppConversation, WhatsAppNumber, WhatsAppMessage } from '@/lib/supabase'

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

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: 'Ouverte', color: 'bg-blue-500/15 text-blue-600' },
  pending_human: { label: 'Transfert humain', color: 'bg-amber-500/15 text-amber-600' },
  closed: { label: 'Fermée', color: 'bg-muted text-muted-foreground' },
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)']

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
  if (data.length === 0) {
    return <div className="h-[170px] grid place-items-center text-xs text-muted-foreground">Pas encore de données</div>
  }
  return (
    <ResponsiveContainer width="100%" height={170}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="bottom" height={28} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function WhatsAppOverviewPage() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [kbCount, setKbCount] = useState(0)
  const [ruleCount, setRuleCount] = useState(0)
  const [aiCost30d, setAiCost30d] = useState(0)
  const [tenantsWithUsage, setTenantsWithUsage] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    Promise.allSettled([
      getWhatsAppNumbers(),
      getWhatsAppConversations(),
      getWhatsAppMessagesForAnalytics(),
      getWhatsAppKbArticles(),
      getWhatsAppAutoReplies(),
      getUsageSummaryAllTenants(since30d),
    ]).then(([n, c, m, kb, rules, usage]) => {
      if (n.status === 'fulfilled') setNumbers(n.value)
      if (c.status === 'fulfilled') setConversations(c.value)
      if (m.status === 'fulfilled') setMessages(m.value)
      if (kb.status === 'fulfilled') setKbCount(kb.value.filter(a => a.is_active).length)
      if (rules.status === 'fulfilled') setRuleCount(rules.value.filter(r => r.is_active).length)
      if (usage.status === 'fulfilled') {
        setAiCost30d(usage.value.reduce((sum, u) => sum + u.total_cost, 0))
        setTenantsWithUsage(new Set(usage.value.map(u => u.client_id).filter(id => id !== null)).size)
      }
    }).finally(() => setLoading(false))
  }, [])

  const openCount = conversations.filter(c => c.status === 'open').length
  const pendingHumanCount = conversations.filter(c => c.status === 'pending_human').length
  const activeNumbers = numbers.filter(n => n.status === 'active').length
  const recent = conversations.slice(0, 6)

  const messagesByConvo = useMemo(() => {
    const map = new Map<string, WhatsAppMessage[]>()
    for (const m of messages) {
      if (!map.has(m.conversation_id)) map.set(m.conversation_id, [])
      map.get(m.conversation_id)!.push(m)
    }
    return map
  }, [messages])

  const botReplyRate = useMemo(() => {
    if (messagesByConvo.size === 0) return null
    let withBot = 0
    messagesByConvo.forEach(msgs => { if (msgs.some(m => m.sender_type === 'bot')) withBot++ })
    return Math.round((withBot / messagesByConvo.size) * 100)
  }, [messagesByConvo])

  const avgResponseMinutes = useMemo(() => {
    const gaps: number[] = []
    messagesByConvo.forEach(msgs => {
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].direction === 'inbound' && sorted[i + 1].direction === 'outbound') {
          gaps.push((new Date(sorted[i + 1].created_at).getTime() - new Date(sorted[i].created_at).getTime()) / 60000)
        }
      }
    })
    if (gaps.length === 0) return null
    return Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10
  }, [messagesByConvo])

  const volumeByDay = useMemo(() => {
    const days: { date: string; label: string; client: number; assistant: number }[] = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), client: 0, assistant: 0 })
    }
    const map = new Map(days.map(d => [d.date, d]))
    for (const m of messages) {
      const row = map.get(m.created_at.slice(0, 10))
      if (!row) continue
      if (m.direction === 'inbound') row.client++
      else row.assistant++
    }
    return days
  }, [messages])

  const channelSplit = useMemo(() => {
    const wa = conversations.filter(c => c.channel !== 'website').length
    const web = conversations.filter(c => c.channel === 'website').length
    return [{ name: 'WhatsApp', value: wa }, { name: 'Site web', value: web }].filter(d => d.value > 0)
  }, [conversations])

  const statusSplit = useMemo(() =>
    (['open', 'pending_human', 'closed'] as const)
      .map(s => ({ name: STATUS_META[s].label, value: conversations.filter(c => c.status === s).length }))
      .filter(d => d.value > 0),
  [conversations])

  const messageTypeSplit = useMemo(() => {
    const counts: Record<string, number> = { text: 0, audio: 0, image: 0 }
    for (const m of messages) {
      if (m.direction !== 'inbound') continue
      const t = m.message_type ?? 'text'
      counts[t] = (counts[t] ?? 0) + 1
    }
    return [
      { name: 'Texte', value: counts.text },
      { name: 'Audio', value: counts.audio },
      { name: 'Image', value: counts.image },
    ].filter(d => d.value > 0)
  }, [messages])

  const senderSplit = useMemo(() => {
    const counts: Record<string, number> = { customer: 0, bot: 0, agent: 0 }
    for (const m of messages) counts[m.sender_type] = (counts[m.sender_type] ?? 0) + 1
    return [
      { name: 'Client', value: counts.customer },
      { name: 'Assistant', value: counts.bot },
      { name: 'Agent humain', value: counts.agent },
    ].filter(d => d.value > 0)
  }, [messages])

  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}h`, count: 0 }))
    for (const m of messages) hours[new Date(m.created_at).getHours()].count++
    return hours
  }, [messages])

  const lastWhatsAppSync = useMemo(() => {
    const wa = messages.find(m => m.channel !== 'website')
    return wa?.created_at ?? null
  }, [messages])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-serif flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg shadow-blue-500/40 grid place-items-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </span>
            BizKey Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Automatisation WhatsApp — réponses automatiques, base de connaissances et transfert humain.</p>
        </div>
        {lastWhatsAppSync ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Dernier message WhatsApp (n8n) : {new Date(lastWhatsAppSync).toLocaleString('fr-FR')}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
            Aucun message WhatsApp reçu via n8n pour l'instant
          </div>
        )}
      </div>

      {numbers.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Aucun numéro WhatsApp Business connecté.{' '}
              <Link to="/app/assistant/numbers" className="underline font-medium">Ajoutez-en un</Link> pour activer l'assistant, ou testez-le dès maintenant depuis les Conversations.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Numéros actifs" accent="sapphire" icon={Smartphone} value={activeNumbers} sub={`${numbers.length} au total`} />
        <MetricCard title="Conversations ouvertes" accent="teal" icon={MessageCircle} value={openCount} sub={`${conversations.length} au total`} />
        <MetricCard title="En attente humain" accent="amber" icon={UserRound} value={pendingHumanCount} sub="transférées par le bot" />
        <MetricCard title="Taux de réponse auto" accent="violet" icon={Bot} value={botReplyRate != null ? `${botReplyRate}%` : '—'} sub={`${ruleCount} règles · ${kbCount} articles`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Messages (échantillon)" accent="rose" icon={TrendingUp} value={messages.length} sub="1000 derniers messages" />
        <MetricCard title="Temps de réponse moyen" accent="sky" icon={Clock} value={avgResponseMinutes != null ? `${avgResponseMinutes} min` : '—'} sub="entre client et réponse" />
        <MetricCard title="Chats site web" accent="teal" icon={Globe} value={conversations.filter(c => c.channel === 'website').length} sub="sans compte requis" />
        <MetricCard title="Chats WhatsApp" accent="sapphire" icon={Smartphone} value={conversations.filter(c => c.channel !== 'website').length} sub="via n8n" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Coût IA (30 jours)" accent="amber" icon={Sparkles} value={`$${aiCost30d.toFixed(4)}`} sub="tous clients confondus" />
        <MetricCard title="Entreprises actives" accent="violet" icon={Building2} value={tenantsWithUsage} sub="avec au moins 1 message (30j)" />
      </div>

      <ChartCard title="Volume de messages" subtitle="14 derniers jours" icon={TrendingUp}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={volumeByDay}>
            <defs>
              <linearGradient id="clientGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="assistantGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} width={28} />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="client" name="Messages clients" stroke="var(--chart-4)" fill="url(#clientGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="assistant" name="Réponses assistant" stroke="var(--chart-1)" fill="url(#assistantGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartCard title="Canal" subtitle="WhatsApp vs site web" icon={Globe}>
          <DonutMini data={channelSplit} />
        </ChartCard>
        <ChartCard title="Statut" subtitle="des conversations" icon={MessageCircle}>
          <DonutMini data={statusSplit} />
        </ChartCard>
        <ChartCard title="Type de message" subtitle="messages entrants" icon={Bot}>
          <DonutMini data={messageTypeSplit} />
        </ChartCard>
        <ChartCard title="Qui répond ?" subtitle="automatisation vs humain" icon={UserRound}>
          <DonutMini data={senderSplit} />
        </ChartCard>
      </div>

      <ChartCard title="Activité par heure" subtitle="quand vos clients écrivent" icon={Clock}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={hourlyActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval={1} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} width={28} />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" name="Messages" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2.5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-blue-400 to-blue-700" />
          Conversations récentes
        </p>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune conversation pour l'instant. Utilisez le simulateur dans Conversations pour tester l'assistant.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {recent.map(c => {
                const st = STATUS_META[c.status]
                return (
                  <Link key={c.id} to="/app/assistant/conversations" className="flex items-center justify-between gap-3 p-3.5 hover:bg-secondary/30 transition">
                    <div className="min-w-0 flex items-center gap-2">
                      {c.channel === 'website'
                        ? <Globe className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                        : <Smartphone className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.customer_name || c.customer_phone}</p>
                        <p className="text-xs text-muted-foreground">{c.channel === 'website' ? 'Chat site web' : c.customer_phone} · {new Date(c.last_message_at).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
