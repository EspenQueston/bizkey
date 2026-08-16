import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle, Smartphone, Bot, UserRound, BookOpen, Loader2, ChevronRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ACCENTS, type AccentName } from '@/lib/accentPalette'
import {
  getWhatsAppNumbers, getWhatsAppConversations, getWhatsAppMessages,
  getWhatsAppKbArticles, getWhatsAppAutoReplies,
} from '@/lib/db'
import type { WhatsAppConversation, WhatsAppNumber } from '@/lib/supabase'

interface MetricCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.FC<{ className?: string }>
  accent: AccentName
}

function MetricCard({ title, value, sub, icon: Icon, accent }: MetricCardProps) {
  const a = ACCENTS[accent]
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

export default function WhatsAppOverviewPage() {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [botReplyRate, setBotReplyRate] = useState<number | null>(null)
  const [kbCount, setKbCount] = useState(0)
  const [ruleCount, setRuleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getWhatsAppNumbers(),
      getWhatsAppConversations(),
      getWhatsAppKbArticles(),
      getWhatsAppAutoReplies(),
    ]).then(async ([n, c, kb, rules]) => {
      if (n.status === 'fulfilled') setNumbers(n.value)
      if (kb.status === 'fulfilled') setKbCount(kb.value.filter(a => a.is_active).length)
      if (rules.status === 'fulfilled') setRuleCount(rules.value.filter(r => r.is_active).length)
      if (c.status === 'fulfilled') {
        setConversations(c.value)
        // Bot-reply rate: share of conversations where the most recent inbound
        // message got an automatic bot reply rather than falling to a human.
        const sample = c.value.slice(0, 30)
        const results = await Promise.allSettled(sample.map(conv => getWhatsAppMessages(conv.id)))
        let withBotReply = 0
        let total = 0
        results.forEach(r => {
          if (r.status !== 'fulfilled' || r.value.length === 0) return
          total++
          if (r.value.some(m => m.sender_type === 'bot')) withBotReply++
        })
        setBotReplyRate(total > 0 ? Math.round((withBotReply / total) * 100) : null)
      }
    }).finally(() => setLoading(false))
  }, [])

  const openCount = conversations.filter(c => c.status === 'open').length
  const pendingHumanCount = conversations.filter(c => c.status === 'pending_human').length
  const activeNumbers = numbers.filter(n => n.status === 'active').length
  const recent = conversations.slice(0, 6)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-serif flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 shadow-lg shadow-blue-500/40 grid place-items-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </span>
          BizKey Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Automatisation WhatsApp — réponses automatiques, base de connaissances et transfert humain.</p>
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.customer_name || c.customer_phone}</p>
                      <p className="text-xs text-muted-foreground">{c.customer_phone} · {new Date(c.last_message_at).toLocaleString('fr-FR')}</p>
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
