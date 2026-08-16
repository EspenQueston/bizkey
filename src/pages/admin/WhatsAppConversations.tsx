import { useEffect, useState } from 'react'
import { MessageCircle, Send, X, UserRound, Bot, CheckCircle2, Play, Globe, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getWhatsAppConversations, getWhatsAppMessages, sendWhatsAppAgentReply,
  updateWhatsAppConversation, simulateIncomingWhatsAppMessage, getWhatsAppNumbers,
} from '@/lib/db'
import type { WhatsAppConversation, WhatsAppConversationStatus, WhatsAppMessage, WhatsAppNumber } from '@/lib/supabase'
import { toast } from 'sonner'

const STATUS_META: Record<WhatsAppConversationStatus, { label: string; color: string; icon: string }> = {
  open:          { label: 'Ouverte',           color: 'bg-blue-500/15 text-blue-600',   icon: '💬' },
  pending_human: { label: 'Transfert humain',  color: 'bg-amber-500/15 text-amber-600', icon: '🙋' },
  closed:        { label: 'Fermée',            color: 'bg-muted text-muted-foreground', icon: '✅' },
}

export default function WhatsAppConversationsPage() {
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

  useEffect(() => {
    Promise.allSettled([getWhatsAppConversations(), getWhatsAppNumbers()]).then(([c, n]) => {
      if (c.status === 'fulfilled') {
        setConversations(c.value)
        if (c.value.length > 0) setSelectedId(c.value[0].id)
      }
      if (n.status === 'fulfilled') setNumbers(n.value)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    setLoadingThread(true)
    getWhatsAppMessages(selectedId).then(setMessages).catch(console.error).finally(() => setLoadingThread(false))
  }, [selectedId])

  const selected = conversations.find(c => c.id === selectedId) ?? null

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
      })
      const fresh = await getWhatsAppConversations()
      setConversations(fresh)
      setSelectedId(conversation.id)
      setShowSimModal(false)
      setSimForm({ customer_phone: '', customer_name: '', body: '' })
    } catch (err) {
      console.error(err)
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="p-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">💬 Conversations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowSimModal(true)} variant="outline" className="rounded-full gap-2">
          <Play className="h-4 w-4" />
          Simuler un message entrant
        </Button>
      </div>

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
            <Button onClick={() => setShowSimModal(true)} size="sm" className="rounded-full gap-1.5"><Play className="h-3.5 w-3.5" />Simuler un message</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation list */}
          <Card className="w-72 shrink-0 overflow-hidden">
            <CardContent className="p-0 h-full overflow-y-auto divide-y divide-border">
              {conversations.map(c => {
                const st = STATUS_META[c.status]
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
                      <Badge className={`text-[9px] shrink-0 ${st.color}`}>{st.icon}</Badge>
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
                      >
                        {STATUS_META[s].icon} {STATUS_META[s].label}
                      </Button>
                    ))}
                  </div>
                </div>
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
                    placeholder="Répondre en tant qu'agent..."
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                    className="h-10"
                  />
                  <Button onClick={handleSendReply} disabled={sending || !reply.trim()} className="rounded-full gap-1.5 shrink-0">
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
