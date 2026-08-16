import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, MessageCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildWhatsAppUrl } from '@/lib/whatsapp'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-website-chat`
const VISITOR_ID_KEY = 'bizkey_web_visitor_id'
const HAS_OPENED_KEY = 'bizkey_web_chat_opened'
const POLL_MS = 5000

interface ChatMessage {
  id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'customer' | 'bot' | 'agent'
  body: string
  created_at: string
}

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, id)
  }
  return id
}

/**
 * No-login BizKey Assistant chat — open to any visitor, mirroring how
 * WhatsApp itself never required a BizKey account. Same conversation store
 * as the WhatsApp bridge (tagged channel: 'website'), so an admin sees and
 * can reply to these threads from the same Conversations page. Replies use
 * the deterministic keyword/KB engine today; swapping in n8n's AI Agent
 * later needs no change here, only a backend change.
 */
export function WhatsAppChatWidget() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [showTeaser, setShowTeaser] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<'open' | 'pending_human' | undefined>(undefined)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const visitorIdRef = useRef<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    visitorIdRef.current = getVisitorId()
    fetchHistory()

    if (!localStorage.getItem(HAS_OPENED_KEY)) {
      const t = setTimeout(() => setShowTeaser(true), 2500)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (open) {
      localStorage.setItem(HAS_OPENED_KEY, '1')
      setShowTeaser(false)
      fetchHistory()
      pollRef.current = setInterval(fetchHistory, POLL_MS)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function fetchHistory() {
    if (!visitorIdRef.current) return
    try {
      setLoadingHistory(prev => (messages.length === 0 ? true : prev))
      const res = await fetch(`${FUNCTIONS_URL}?visitorId=${visitorIdRef.current}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages ?? [])
      setStatus(data.status)
    } catch {
      // Silent — chat degrades to "not available right now" rather than an error toast.
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    // Optimistic append so the UI feels instant.
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      direction: 'inbound',
      sender_type: 'customer',
      body: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: visitorIdRef.current, message: text }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, data.reply as ChatMessage])
      }
      setStatus(data.needsHuman ? 'pending_human' : 'open')
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          direction: 'outbound',
          sender_type: 'bot',
          body: "Connexion impossible pour le moment. Réessayez, ou écrivez-nous directement sur WhatsApp.",
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  // Hidden inside the authenticated panel — that surface has its own support paths.
  if (pathname.startsWith('/app')) return null

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-[92vw] max-w-[380px] h-[70vh] max-h-[560px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#0A1B33] to-[#162B49] px-4 py-3.5 flex items-center gap-3 shrink-0">
              <div className="h-10 w-10 rounded-full bg-primary/15 grid place-items-center shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">BizKey Assistant</div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  En ligne
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-background">
              {loadingHistory ? (
                <div className="h-full grid place-items-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2">
                  <Bot className="h-8 w-8 text-primary/40" />
                  <p className="text-sm font-medium">Bonjour 👋</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Posez votre question — livraison, produit, commande — l'assistant BizKey vous répond.
                  </p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.direction === 'inbound'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-secondary text-secondary-foreground rounded-bl-md'
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))
              )}

              {status === 'pending_human' && (
                <div className="rounded-xl border border-border bg-card p-3 text-center space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Un conseiller va vous répondre sous peu. Vous pouvez aussi continuer sur WhatsApp.
                  </p>
                  <a
                    href={buildWhatsAppUrl('Bonjour BizKey, je continue notre conversation ici')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Ouvrir WhatsApp
                  </a>
                </div>
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card flex items-center gap-2 shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Écrivez votre message..."
                className="flex-1 h-10 rounded-full border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teaser bubble — shown once for first-time visitors */}
      <AnimatePresence>
        {showTeaser && !open && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="max-w-[220px] rounded-2xl rounded-br-md border border-border bg-card shadow-lg px-4 py-3 text-sm relative"
          >
            <button
              onClick={() => setShowTeaser(false)}
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted grid place-items-center text-muted-foreground hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-3 w-3" />
            </button>
            👋 Besoin d'aide ? Discutez avec BizKey Assistant.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher bubble */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 grid place-items-center"
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat BizKey Assistant'}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? 'close' : 'chat'}
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
