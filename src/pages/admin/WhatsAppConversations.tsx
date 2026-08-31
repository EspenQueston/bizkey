import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X, UserRound, Bot, CheckCircle2, Play, Globe, Smartphone, Ticket, UserCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  getWhatsAppConversations, getWhatsAppMessages, sendWhatsAppAgentReply,
  updateWhatsAppConversation, simulateIncomingWhatsAppMessage, getWhatsAppNumbers,
  getOpenHandoffTickets, updateHandoffTicket, resolveHandoffTicket, getAssistantClientMembers,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage, WhatsAppNumber, HandoffTicket, HandoffTicketPriority, AssistantClientMember } from '@/lib/supabase'
import { toast } from 'sonner'

const STATUS_META: Record<WhatsAppConversationStatus, { label: string; color: string; icon: string }> = {
  open:          { label: 'Ouverte',           color: 'bg-blue-500/15 text-blue-600',   icon: '💬' },
  pending_human: { label: 'Transfert humain',  color: 'bg-amber-500/15 text-amber-600', icon: '🙋' },
  closed:        { label: 'Fermée',            color: 'bg-muted text-muted-foreground', icon: '✅' },
}

const PRIORITY_META: Record<HandoffTicketPriority, { label: string; color: string }> = {
  low:    { label: 'Faible',  color: 'text-muted-foreground border-border' },
  normal: { label: 'Normale', color: 'text-blue-600 border-blue-500/30' },
  high:   { label: 'Élevée',  color: 'text-amber-600 border-amber-500/30' },
  urgent: { label: 'Urgente', color: 'text-destructive border-destructive/30' },
}

const PRIORITY_ORDER: Record<HandoffTicketPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

type StatusFilter = 'all' | WhatsAppConversationStatus
const STATUS_FILTERS: { key: StatusFilter; label: string; icon?: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending_human', label: 'Transfert humain', icon: '🙋' },
  { key: 'open', label: 'Ouvertes', icon: '💬' },
  { key: 'closed', label: 'Fermées', icon: '✅' },
]

export default function WhatsAppConversationsPage() {
  const { user, profile, assistantClient, assistantRole } = useAuth()
  // Admin always has full write access; a business's owner/manager do too —
  // only a viewer (or a plain unauthenticated-for-this-business state) is
  // read-only. Gates the reply box, status buttons, and ticket controls so
  // a viewer sees a disabled UI instead of a write silently failing against
  // handoff_tickets_own_write / whatsapp_conversations_own_update RLS.
  const canWrite = profile?.is_admin || assistantRole === 'owner' || assistantRole === 'manager'

  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [showSimModal, setShowSimModal] = useState(false)
  const [simForm, setSimForm] = useState({ customer_phone: '', customer_name: '', body: '' })
  const [simulating, setSimulating] = useState(false)

  const [tickets, setTickets] = useState<Record<string, HandoffTicket>>({})
  const [members, setMembers] = useState<AssistantClientMember[]>([])
  const [savingTicket, setSavingTicket] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  function refreshTickets() {
    getOpenHandoffTickets()
      .then(list => setTickets(Object.fromEntries(list.map(t => [t.conversation_id, t]))))
      .catch(console.error)
  }

  useEffect(() => {
    Promise.allSettled([getWhatsAppConversations(), getWhatsAppNumbers()]).then(([c, n]) => {
      if (c.status === 'fulfilled') {
        setConversations(c.value)
        if (c.value.length > 0) setSelectedId(c.value[0].id)
      }
      if (n.status === 'fulfilled') setNumbers(n.value)
    }).finally(() => setLoading(false))
    refreshTickets()
  }, [])

  // The currently-open thread, kept in a ref so the message-insert handler
  // below (set up once, on mount) always reads the live selection instead
  // of the value it closed over at subscribe time.
  const selectedIdRef = useRef<string | null>(null)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // Live inbox: without this, a new WhatsApp message or a status change
  // made by a teammate (or n8n) only shows up on the next manual reload.
  // Realtime re-checks each change against the table's RLS before it ever
  // reaches this client, so a business only ever receives its own rows —
  // same scoping getWhatsAppConversations() already relies on.
  useEffect(() => {
    const channel = supabase
      .channel('assistant-inbox')
      .on<WhatsAppConversation>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' },
        ({ new: conv }) => {
          setConversations(prev => {
            if (prev.some(c => c.id === conv.id)) return prev
            toast.info(`Nouvelle conversation — ${conv.customer_name || conv.customer_phone}`)
            return [conv, ...prev]
          })
          setSelectedId(prev => prev ?? conv.id)
        },
      )
      .on<WhatsAppConversation>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' },
        ({ new: conv, old: prevConv }) => {
          if (prevConv?.status !== 'pending_human' && conv.status === 'pending_human') {
            toast.warning(`🙋 Transfert humain demandé — ${conv.customer_name || conv.customer_phone}`)
          }
          setConversations(prev => prev.map(c => c.id === conv.id ? conv : c))
        },
      )
      .on<WhatsAppMessage>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        ({ new: msg }) => {
          setConversations(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, last_message_at: msg.created_at } : c))
          if (msg.conversation_id !== selectedIdRef.current) return
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handoff_tickets' },
        () => refreshTickets(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    setLoadingThread(true)
    getWhatsAppMessages(selectedId).then(setMessages).catch(console.error).finally(() => setLoadingThread(false))
  }, [selectedId])

  const selected = conversations.find(c => c.id === selectedId) ?? null
  const ticket = selected ? tickets[selected.id] : undefined
  const openTicketCount = Object.keys(tickets).length

  // Any conversation with an open ticket bubbles to the top, most urgent
  // first — an agent triaging a busy inbox shouldn't have to open every
  // conversation to find out which ones actually need a human, regardless
  // of which status filter is active.
  const visibleConversations = conversations
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .slice()
    .sort((a, b) => {
      const ta = tickets[a.id]
      const tb = tickets[b.id]
      if (ta && tb) return PRIORITY_ORDER[ta.priority] - PRIORITY_ORDER[tb.priority] || (new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      if (ta) return -1
      if (tb) return 1
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })

  useEffect(() => {
    if (!selected?.client_id) { setMembers([]); return }
    getAssistantClientMembers(selected.client_id).catch(console.error).then(list => setMembers(list ?? []))
  }, [selected?.client_id])

  async function handleSendReply() {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    try {
      const { message: msg, delivered, deliveryError } = await sendWhatsAppAgentReply(selectedId, reply.trim())
      setMessages(prev => [...prev, msg])
      setReply('')
      setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, last_message_at: msg.created_at } : c))
      if (!delivered) {
        toast.error(`Message enregistré mais pas livré sur WhatsApp — ${deliveryError ?? 'webhook n8n non configuré'}`)
      }
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(status: WhatsAppConversationStatus) {
    if (!selectedId) return
    const updated = await updateWhatsAppConversation(selectedId, { status })
    setConversations(prev => prev.map(c => c.id === selectedId ? updated : c))
    // A status change may open or resolve a ticket via trigger — cheap to
    // just refetch the (small) open-tickets set rather than guess the effect.
    refreshTickets()
  }

  async function handleTicketField(patch: Partial<Pick<HandoffTicket, 'priority' | 'reason' | 'assigned_to'>>) {
    if (!ticket) return
    setSavingTicket(true)
    try {
      const updated = await updateHandoffTicket(ticket.id, patch)
      setTickets(prev => ({ ...prev, [updated.conversation_id]: updated }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la mise à jour du ticket')
    } finally {
      setSavingTicket(false)
    }
  }

  async function handleResolveTicket() {
    if (!ticket || !user) return
    setSavingTicket(true)
    try {
      await resolveHandoffTicket(ticket.id, user.id)
      setTickets(prev => {
        const next = { ...prev }
        delete next[ticket.conversation_id]
        return next
      })
      // The resolve trigger flips the conversation back to 'open' server-side.
      setConversations(prev => prev.map(c => c.id === ticket.conversation_id && c.status === 'pending_human' ? { ...c, status: 'open' } : c))
      toast.success('Ticket résolu')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la résolution du ticket')
    } finally {
      setSavingTicket(false)
    }
  }

  async function handleSimulate() {
    if (!simForm.customer_phone.trim() || !simForm.body.trim()) return
    setSimulating(true)
    try {
      const { conversation } = await simulateIncomingWhatsAppMessage({
        customerPhone: simForm.customer_phone.trim(),
        customerName: simForm.customer_name.trim() || undefined,
        numberId: numbers.find(n => n.status === 'active')?.id ?? numbers[0]?.id ?? null,
        body: simForm.body.trim(),
        clientId: assistantClient?.id ?? null,
      })
      const fresh = await getWhatsAppConversations()
      setConversations(fresh)
      setSelectedId(conversation.id)
      refreshTickets()
      setShowSimModal(false)
      setSimForm({ customer_phone: '', customer_name: '', body: '' })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Échec de la simulation')
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="p-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">💬 Conversations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            {openTicketCount > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium"> · {openTicketCount} en attente de transfert</span>}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowSimModal(true)} variant="outline" className="rounded-full gap-2">
            <Play className="h-4 w-4" />
            Simuler un message entrant
          </Button>
        )}
      </div>

      {conversations.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`h-7 rounded-full text-[11px] px-3 font-medium transition flex items-center gap-1 ${
                statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
              }`}
            >
              {f.icon} {f.label}
              {f.key === 'pending_human' && openTicketCount > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] ${statusFilter === f.key ? 'bg-primary-foreground/20' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                  {openTicketCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mr-3" />Chargement...
        </div>
      ) : conversations.length === 0 ? (
        <Card className="flex-1">
          <CardContent className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Aucune conversation pour l'instant</p>
            <p className="text-xs text-muted-foreground max-w-xs">Connectez un numéro WhatsApp Business réel, ou utilisez le simulateur pour tester l'assistant dès maintenant.</p>
            {canWrite && (
              <Button onClick={() => setShowSimModal(true)} size="sm" className="rounded-full gap-1.5"><Play className="h-3.5 w-3.5" />Simuler un message</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation list */}
          <Card className="w-72 shrink-0 overflow-hidden">
            <CardContent className="p-0 h-full overflow-y-auto divide-y divide-border">
              {visibleConversations.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">Aucune conversation avec ce statut</p>
                  <button onClick={() => setStatusFilter('all')} className="text-xs text-primary hover:underline mt-1.5 font-medium">
                    Voir toutes les conversations
                  </button>
                </div>
              )}
              {visibleConversations.map(c => {
                const st = STATUS_META[c.status]
                const t = tickets[c.id]
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3.5 hover:bg-secondary/30 transition ${selectedId === c.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {c.channel === 'website'
                          ? <Globe className="h-3 w-3 text-sky-500 shrink-0" />
                          : <Smartphone className="h-3 w-3 text-emerald-500 shrink-0" />}
                        <span className="truncate">{c.customer_name || c.customer_phone}</span>
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {t && (t.priority === 'high' || t.priority === 'urgent') && (
                          <Badge variant="outline" className={`text-[9px] ${PRIORITY_META[t.priority].color}`}>{PRIORITY_META[t.priority].label}</Badge>
                        )}
                        <Badge className={`text-[9px] ${st.color}`}>{st.icon}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.channel === 'website' ? 'Chat site web' : c.customer_phone}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(c.last_message_at).toLocaleString('fr-FR')}</p>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* Thread */}
          <Card className="flex-1 flex flex-col min-w-0">
            {selected && (
              <>
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {selected.channel === 'website'
                        ? <Globe className="h-3.5 w-3.5 text-sky-500" />
                        : <Smartphone className="h-3.5 w-3.5 text-emerald-500" />}
                      {selected.customer_name || selected.customer_phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.channel === 'website' ? 'Chat du site web' : selected.customer_phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['open', 'pending_human', 'closed'] as const).map(s => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selected.status === s ? 'default' : 'outline'}
                        className="h-7 rounded-full text-[10px] px-2.5"
                        onClick={() => handleStatusChange(s)}
                        disabled={!canWrite}
                      >
                        {STATUS_META[s].icon} {STATUS_META[s].label}
                      </Button>
                    ))}
                  </div>
                </div>

                {selected.status === 'pending_human' && ticket && (
                  <div className="p-4 border-b border-border shrink-0 bg-amber-500/5 space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Ticket className="h-3.5 w-3.5" /> Ticket de transfert
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Priorité</Label>
                        <select
                          value={ticket.priority}
                          onChange={e => handleTicketField({ priority: e.target.value as HandoffTicketPriority })}
                          disabled={!canWrite || savingTicket}
                          className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-60"
                        >
                          {(Object.keys(PRIORITY_META) as HandoffTicketPriority[]).map(p => (
                            <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px] flex items-center gap-1"><UserCheck2 className="h-3 w-3" /> Assigné à</Label>
                        {members.length > 0 ? (
                          <select
                            value={ticket.assigned_to ?? ''}
                            onChange={e => handleTicketField({ assigned_to: e.target.value || null })}
                            disabled={!canWrite || savingTicket}
                            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs disabled:opacity-60"
                          >
                            <option value="">Non assigné</option>
                            {members.filter(m => m.role !== 'viewer').map(m => (
                              <option key={m.id} value={m.profile_id}>{m.profile?.name ?? m.profile?.email}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-muted-foreground h-8 flex items-center">—</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Motif du transfert</Label>
                      <Input
                        placeholder="Ex: demande de remboursement, réclamation..."
                        defaultValue={ticket.reason ?? ''}
                        onBlur={e => e.target.value !== (ticket.reason ?? '') && handleTicketField({ reason: e.target.value.trim() || null })}
                        disabled={!canWrite || savingTicket}
                        className="h-8 text-xs"
                      />
                    </div>
                    {canWrite && (
                      <Button size="sm" className="h-7 rounded-full text-[11px] gap-1.5" onClick={handleResolveTicket} disabled={savingTicket}>
                        {savingTicket ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <CheckCircle2 className="h-3 w-3" />}
                        Marquer résolu
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingThread ? (
                    <div className="text-center text-xs text-muted-foreground py-8">Chargement...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-8">Aucun message</div>
                  ) : (
                    messages.map(m => {
                      const isCustomer = m.direction === 'inbound'
                      return (
                        <div key={m.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            isCustomer ? 'bg-secondary text-secondary-foreground' :
                            m.sender_type === 'bot' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' :
                            'bg-primary text-primary-foreground'
                          }`}>
                            {!isCustomer && (
                              <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                                {m.sender_type === 'bot' ? <Bot className="h-2.5 w-2.5" /> : <UserRound className="h-2.5 w-2.5" />}
                                {m.sender_type === 'bot' ? 'Assistant' : 'Agent'}
                              </div>
                            )}
                            {m.body}
                            <div className="text-[9px] opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="p-3 border-t border-border shrink-0 flex gap-2">
                  <Input
                    placeholder={canWrite ? "Répondre en tant qu'agent..." : 'Lecture seule — vous ne pouvez pas répondre'}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                    disabled={!canWrite}
                    className="h-10"
                  />
                  <Button onClick={handleSendReply} disabled={!canWrite || sending || !reply.trim()} className="rounded-full gap-1.5 shrink-0">
                    {sending ? <span className="h-3.5 w-3.5 border border-current border-t-transparent animate-spin rounded-full" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="font-serif font-bold flex items-center gap-2"><Play className="h-4 w-4 text-primary" />Simuler un message entrant</h2>
              <button onClick={() => setShowSimModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crée un message comme s'il venait d'un vrai client WhatsApp — utile pour tester les règles de réponse automatique et la base de connaissances sans compte WhatsApp Business connecté.
              </p>
              <div className="space-y-1.5">
                <Label>Numéro du client (simulé) *</Label>
                <Input placeholder="+22997000000" value={simForm.customer_phone} onChange={e => setSimForm(f => ({ ...f, customer_phone: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Nom (optionnel)</Label>
                <Input placeholder="Client test" value={simForm.customer_name} onChange={e => setSimForm(f => ({ ...f, customer_name: e.target.value }))} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Message *</Label>
                <textarea
                  rows={3}
                  placeholder="Bonjour, je cherche une enceinte bluetooth..."
                  value={simForm.body}
                  onChange={e => setSimForm(f => ({ ...f, body: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-border">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setShowSimModal(false)}>Annuler</Button>
              <Button className="flex-1 rounded-full gap-1.5" onClick={handleSimulate} disabled={simulating || !simForm.customer_phone.trim() || !simForm.body.trim()}>
                {simulating ? <span className="h-3 w-3 border border-current border-t-transparent animate-spin rounded-full" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
