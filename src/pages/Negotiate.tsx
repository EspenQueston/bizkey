import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  MessageSquare, Target, Copy, CheckCheck, Info,
  Sparkles, Send, Bot, User, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getUserAnalyses } from '@/lib/db'
import { startNegotiationChat, sendNegotiationMessage } from '@/lib/api'
import type { NegotiationChatMessage } from '@/lib/api'
import type { Database } from '@/lib/supabase'

type Analysis = Database['public']['Tables']['analyses']['Row']

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    // If the message contains a ready-to-send Chinese message, copy just that part.
    const match = text.match(/Message à envoyer\s*:?\s*\n?([\s\S]+?)(?:\n\(|\n\n|$)/)
    await navigator.clipboard.writeText(match ? match[1].trim() : text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs px-2 -mb-1" onClick={handleCopy}>
      {copied ? <CheckCheck className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copié !' : 'Copier'}
    </Button>
  )
}

function ChatBubble({ message }: { message: NegotiationChatMessage }) {
  const isAssistant = message.role === 'assistant'
  return (
    <div className={`flex gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div className={`h-8 w-8 rounded-full grid place-items-center flex-shrink-0 ${isAssistant ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isAssistant ? 'bg-secondary/60 border border-border' : 'bg-primary text-primary-foreground'}`}>
        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isAssistant ? '' : ''}`}>{message.content}</p>
        {isAssistant && <CopyButton text={message.content} />}
      </div>
    </div>
  )
}

export default function NegotiatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('analysisId')

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selectedId, setSelectedId] = useState(preselectedId ?? '')
  const [targetPrice, setTargetPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)

  const [negotiationId, setNegotiationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NegotiationChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    getUserAnalyses(user.id)
      .then((list) => {
        setAnalyses(list)
        const pre = list.find((a) => a.id === preselectedId)
        if (pre) {
          setSelectedAnalysis(pre)
          if (pre.price) setTargetPrice((pre.price * 0.78).toFixed(2))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, navigate, preselectedId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function handleSelectChange(id: string) {
    setSelectedId(id)
    const a = analyses.find((x) => x.id === id)
    setSelectedAnalysis(a ?? null)
    if (a?.price) setTargetPrice((a.price * 0.78).toFixed(2))
    resetChat()
  }

  function resetChat() {
    setNegotiationId(null)
    setMessages([])
    setError('')
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || !targetPrice) return
    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) { setError('Entrez un prix cible valide'); return }

    setStarting(true)
    setError('')

    try {
      const res = await startNegotiationChat(selectedId, price)
      setNegotiationId(res.negotiation.id)
      setMessages(res.negotiation.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage de la négociation')
    } finally {
      setStarting(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!negotiationId || !draft.trim() || sending) return

    const text = draft.trim()
    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }])
    setSending(true)
    setError('')

    try {
      const res = await sendNegotiationMessage(negotiationId, text)
      setMessages(res.negotiation.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi du message")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ══════ TITLE ══════ */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1 text-xs font-medium mb-3">
            <MessageSquare className="h-3 w-3 text-primary" />
            Stratégie de négociation IA
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">
            🎯 Négocier avec le fournisseur
          </h1>
          <p className="text-muted-foreground text-sm">
            Discutez en direct avec votre agent IA de négociation — il connaît le produit, le fournisseur et votre prix cible, et vous aide à formuler chaque message.
          </p>
        </div>

        {/* ══════ SETUP FORM ══════ */}
        <Card className="border-2 border-border shadow-sm">
          <CardContent className="p-6">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
                Chargement...
              </div>
            ) : analyses.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm mb-4">Aucune analyse disponible. Analysez d'abord un produit.</p>
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/app/analyze">Analyser un produit</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleStart} className="space-y-5">
                <div className="space-y-2">
                  <Label>Produit à négocier</Label>
                  <select
                    value={selectedId}
                    onChange={(e) => handleSelectChange(e.target.value)}
                    className="w-full h-11 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                    disabled={negotiationId !== null}
                  >
                    <option value="">Sélectionnez un produit analysé…</option>
                    {analyses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.product_name ?? 'Produit'} — {a.price ? `¥${a.price}` : '—'} | Score: {a.confidence_score ?? '?'}/100
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAnalysis && (
                  <div className="p-4 rounded-xl bg-secondary/50 border border-border grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Prix actuel</div>
                      <div className="font-bold">{selectedAnalysis.price ? `¥${selectedAnalysis.price}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">MOQ</div>
                      <div className="font-bold">{selectedAnalysis.moq ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div className="font-bold">{selectedAnalysis.confidence_score ?? '—'}/100</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="targetPrice" className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    Prix cible (¥/unité)
                  </Label>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Ex: 2.10"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="h-11"
                    required
                    disabled={negotiationId !== null}
                  />
                  {selectedAnalysis?.price && targetPrice && (
                    <p className="text-xs text-muted-foreground">
                      Réduction souhaitée : <span className="font-medium">{(((selectedAnalysis.price - parseFloat(targetPrice)) / selectedAnalysis.price) * 100).toFixed(1)}%</span>
                    </p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {negotiationId === null ? (
                  <Button type="submit" className="w-full h-12 rounded-full" disabled={starting || !selectedId || !targetPrice}>
                    {starting ? (
                      <><span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />Démarrage de la négociation…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Démarrer la négociation avec l'IA</>
                    )}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="w-full h-10 rounded-full gap-1.5" onClick={resetChat}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Changer de produit / recommencer
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* ══════ CHAT ══════ */}
        {negotiationId && (
          <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/15 px-5 py-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Agent de négociation IA</span>
              <span className="ml-auto text-xs text-muted-foreground">{selectedAnalysis?.product_name?.slice(0, 30)}</span>
            </div>

            <div ref={scrollRef} className="max-h-[28rem] overflow-y-auto px-5 py-5 space-y-4 bg-gradient-to-b from-transparent to-secondary/10">
              {messages.map((m, i) => (
                <ChatBubble key={i} message={m} />
              ))}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-secondary/60 border border-border flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mx-5 mb-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleSend} className="border-t border-border p-3 flex items-center gap-2 bg-card">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Posez une question ou demandez un message pour le fournisseur…"
                className="h-11 flex-1"
                disabled={sending}
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-full flex-shrink-0" disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        )}

        {negotiationId && (
          <div className="p-4 rounded-xl bg-secondary/50 border border-border">
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" />
              <span>
                Utilisez le bouton "Copier" sur les messages de l'IA pour envoyer directement via
                <span className="font-medium"> Alibaba Trade Manager</span>,
                <span className="font-medium"> WeChat</span> ou l'application
                <span className="font-medium"> 1688</span>.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
