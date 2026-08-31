import { useEffect, useMemo, useState } from 'react'
import { Search, Users, Smartphone, MessageCircle, CheckCircle2, Clock, UserRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { getWhatsAppContacts, getWhatsAppConversations } from '@/lib/db'
import type { WhatsAppContact, WhatsAppConversation } from '@/lib/supabase'

/** Per-contact rollup computed client-side from the conversations list — the conversations table already carries contact_id, so no extra query is needed just to know "how many conversations, when last active" per contact. */
interface ContactStats {
  count: number
  lastActivity: string | null
}

export default function AssistantContactsPage() {
  const { profile, assistantClient } = useAuth()
  const isAdmin = profile?.is_admin === true
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (isAdmin && !assistantClient) { setLoading(false); return }
    Promise.allSettled([getWhatsAppContacts(), getWhatsAppConversations()]).then(([c, conv]) => {
      if (c.status === 'fulfilled') setContacts(c.value)
      if (conv.status === 'fulfilled') setConversations(conv.value)
    }).finally(() => setLoading(false))
  }, [isAdmin, assistantClient])

  const statsByContact = useMemo(() => {
    const map = new Map<string, ContactStats>()
    for (const conv of conversations) {
      if (!conv.contact_id) continue
      const existing = map.get(conv.contact_id)
      if (!existing) {
        map.set(conv.contact_id, { count: 1, lastActivity: conv.last_message_at })
      } else {
        existing.count += 1
        if (new Date(conv.last_message_at) > new Date(existing.lastActivity ?? 0)) existing.lastActivity = conv.last_message_at
      }
    }
    return map
  }, [conversations])

  const filtered = contacts.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return c.whatsapp_number.toLowerCase().includes(s) || (c.display_name ?? '').toLowerCase().includes(s)
  })

  if (isAdmin && !assistantClient) {
    return (
      <div className="p-6">
        <div className="py-16 text-center max-w-md mx-auto">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Vue par entreprise</p>
          <p className="text-xs text-muted-foreground mt-1">
            Les contacts sont propres à chaque entreprise cliente — consultez « Clients Assistant » pour la vue d'ensemble multi-entreprises.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Contacts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''} WhatsApp
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher par nom ou numéro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">{contacts.length === 0 ? 'Aucun contact pour l\'instant' : 'Aucun résultat'}</p>
          {contacts.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Un contact apparaît ici automatiquement dès qu'un client vous écrit sur WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(contact => {
            const stats = statsByContact.get(contact.id)
            return (
              <Card key={contact.id} className="hover:border-primary/30 transition">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 grid place-items-center flex-shrink-0">
                        <UserRound className="h-4.5 w-4.5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{contact.display_name || contact.whatsapp_number}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate flex items-center gap-1">
                          <Smartphone className="h-3 w-3 shrink-0" />{contact.whatsapp_number}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${contact.is_provisional ? 'text-muted-foreground border-border' : 'text-primary border-primary/30'}`}
                    >
                      {contact.is_provisional ? 'Non lié' : 'Compte lié'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {stats?.count ?? 0} conversation{(stats?.count ?? 0) > 1 ? 's' : ''}</span>
                    <span className="flex items-center gap-1">
                      {contact.is_provisional ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      Depuis le {new Date(contact.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
