import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAllTransactions, updateTransaction } from '@/lib/db'
import type { PaymentTransaction } from '@/lib/supabase'
import { toast } from 'sonner'

export default function AdminWebhooks() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [replayingId, setReplayingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const all = await getAllTransactions()
      setTransactions(all.filter(t => t.status === 'pending' || t.status === 'failed'))
    } catch (err) {
      console.warn('AdminWebhooks load error:', err)
      setTransactions([])
      toast.error('Impossible de charger les webhooks. Vérifiez les permissions RLS.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleReplay(tx: PaymentTransaction) {
    setReplayingId(tx.id)
    try {
      // Re-check payment status via edge function
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'status',
          provider: tx.gateway,
          transactionId: tx.gateway_transaction_id,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const status = await res.json() as { status: string }

      if (status.status === 'success' || status.status === 'failed') {
        const updated = await updateTransaction(tx.id, {
          status: status.status as PaymentTransaction['status'],
          webhook_received_at: new Date().toISOString(),
        })
        setTransactions(prev => prev.filter(t => t.id !== updated.id))
        toast.success(`Statut mis à jour: ${status.status}`)
      } else {
        toast.info('Paiement toujours en attente')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de relance')
    } finally {
      setReplayingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground text-sm">Transactions en attente ou échouées</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <div>
              <p className="font-medium">Aucune transaction en suspens</p>
              <p className="text-sm text-muted-foreground mt-1">Tous les webhooks ont été traités correctement</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{transactions.length} transaction(s) sans webhook confirmé. Relancez pour vérifier le statut.</span>
          </div>
          {transactions.map(tx => (
            <Card key={tx.id} className="border">
              <CardContent className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 12)}…</span>
                    <Badge className={tx.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 text-xs'}>
                      {tx.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{tx.gateway}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tx.gateway_transaction_id ?? 'Pas d\'ID gateway'} · {new Date(tx.created_at).toLocaleString('fr')}
                  </div>
                  {tx.phone_number && (
                    <div className="text-xs text-muted-foreground">{tx.phone_number} · {tx.country_code}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold">{tx.amount_local.toLocaleString()} {tx.currency}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={replayingId === tx.id || !tx.gateway_transaction_id}
                    onClick={() => handleReplay(tx)}
                  >
                    {replayingId === tx.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <><RefreshCw className="h-3.5 w-3.5 mr-1" />Relancer</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
