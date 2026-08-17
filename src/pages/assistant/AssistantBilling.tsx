import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Crown, MessageSquare, Smartphone, ArrowUpRight, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { getAllAssistantPlans, getUserTransactions, getWhatsAppConversations } from '@/lib/db'
import type { AssistantClientStatus, AssistantPlan, PaymentTransaction } from '@/lib/supabase'

const STATUS_META: Record<AssistantClientStatus, { label: string; color: string }> = {
  trial:     { label: 'Essai',     color: 'bg-blue-500/15 text-blue-600' },
  active:    { label: 'Actif',     color: 'bg-primary/15 text-primary' },
  suspended: { label: 'Suspendu',  color: 'bg-amber-500/15 text-amber-600' },
  cancelled: { label: 'Résilié',   color: 'bg-destructive/15 text-destructive' },
  expired:   { label: 'Expiré',    color: 'bg-secondary text-muted-foreground' },
}

const TX_STATUS_META: Record<PaymentTransaction['status'], { label: string; color: string }> = {
  success: { label: 'Payé',     color: 'text-primary border-primary/30' },
  pending: { label: 'En cours', color: 'text-amber-600 border-amber-500/30' },
  failed:  { label: 'Échoué',   color: 'text-destructive border-destructive/30' },
  refunded:{ label: 'Remboursé', color: 'text-muted-foreground border-border' },
}

export default function AssistantBillingPage() {
  const { user, assistantClient } = useAuth()
  const [plans, setPlans] = useState<AssistantPlan[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [conversationsThisMonth, setConversationsThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.allSettled([
      getAllAssistantPlans(),
      getUserTransactions(user.id),
      getWhatsAppConversations(),
    ]).then(([p, tx, convos]) => {
      if (p.status === 'fulfilled') setPlans(p.value)
      if (tx.status === 'fulfilled') setTransactions(tx.value.filter(t => t.assistant_plan_id))
      if (convos.status === 'fulfilled') {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        setConversationsThisMonth(convos.value.filter(c => c.created_at >= startOfMonth).length)
      }
    }).finally(() => setLoading(false))
  }, [user])

  if (!assistantClient) {
    return (
      <div className="p-6">
        <div className="py-16 text-center max-w-md mx-auto">
          <CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun abonnement Assistant actif</p>
          <Button asChild size="sm" className="mt-3 rounded-full">
            <Link to="/pricing">Voir les formules</Link>
          </Button>
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

  const currentPlan = plans.find(p => p.id === assistantClient.plan_id)
  const statusMeta = STATUS_META[assistantClient.status]
  const usagePercent = currentPlan?.max_conversations_per_month
    ? Math.min(100, Math.round((conversationsThisMonth / currentPlan.max_conversations_per_month) * 100))
    : 0

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> Facturation & abonnement</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{assistantClient.company_name}</p>
      </div>

      {/* Current plan */}
      <Card className="border-2 border-primary/20">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
                <Crown className="h-3.5 w-3.5 text-primary" /> Formule actuelle
              </p>
              <p className="text-xl font-bold">{currentPlan?.display_name ?? 'Aucune formule'}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge className={`text-xs ${statusMeta.color}`}>{statusMeta.label}</Badge>
              {currentPlan && <p className="text-lg font-black text-primary">¥{currentPlan.price_yuan}<span className="text-xs font-normal text-muted-foreground">/mois</span></p>}
            </div>
          </div>
          {currentPlan && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              {currentPlan.features.slice(0, 4).map(f => (
                <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" className="w-full rounded-full gap-1.5">
            <Link to="/pricing">
              <ArrowUpRight className="h-4 w-4" /> Changer de formule
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Usage snapshot */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Consommation ce mois-ci
          </p>
          <div className="flex items-end justify-between">
            <p className="text-2xl font-black">{conversationsThisMonth.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-muted-foreground">
              {currentPlan ? `sur ${currentPlan.max_conversations_per_month.toLocaleString('fr-FR')} conversations/mois` : 'conversations'}
            </p>
          </div>
          {currentPlan && (
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usagePercent >= 90 ? 'bg-destructive' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Smartphone className="h-3.5 w-3.5" />
            {currentPlan ? `${currentPlan.max_numbers} numéro${currentPlan.max_numbers > 1 ? 's' : ''} inclus` : ''}
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Historique des paiements
          </p>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement pour l'instant</p>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="text-xs text-muted-foreground">{tx.payment_method ?? tx.gateway}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{tx.amount_local.toLocaleString('fr-FR')} {tx.currency}</p>
                    <Badge variant="outline" className={`text-[10px] ${TX_STATUS_META[tx.status].color}`}>{TX_STATUS_META[tx.status].label}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
