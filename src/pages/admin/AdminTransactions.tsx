import { useEffect, useState } from 'react'
import { Search, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getAllTransactions } from '@/lib/db'
import type { PaymentTransaction } from '@/lib/supabase'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  success:  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  failed:   'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  refunded: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  async function load() {
    setLoading(true)
    try {
      const txs = await getAllTransactions(statusFilter !== 'all' ? { status: statusFilter } : {})
      setTransactions(txs)
    } catch (err) {
      console.warn('AdminTransactions load error:', err)
      setTransactions([])
      toast.error('Impossible de charger les transactions. Vérifiez les permissions RLS.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = transactions.filter(tx => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      tx.id.toLowerCase().includes(s) ||
      (tx.phone_number ?? '').includes(s) ||
      (tx.country_code ?? '').toLowerCase().includes(s) ||
      (tx.gateway_transaction_id ?? '').toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">Historique des paiements</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualiser
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {['all', 'pending', 'success', 'failed', 'refunded'].map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className="capitalize text-xs"
            >
              {s === 'all' ? 'Tous' : s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Aucune transaction trouvée</p>
          )}
          {filtered.map(tx => (
            <Card key={tx.id} className="border">
              <CardContent className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 8)}…</span>
                    <Badge className={`text-xs ${STATUS_COLORS[tx.status] ?? ''}`}>{tx.status}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{tx.gateway}</span>
                    {tx.country_code && <span className="text-xs text-muted-foreground">{tx.country_code}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tx.phone_number ?? '—'} · {tx.payment_method ?? '—'} · {new Date(tx.created_at).toLocaleDateString('fr')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{tx.amount_local.toLocaleString()} {tx.currency}</div>
                  {tx.amount_usd && <div className="text-xs text-muted-foreground">${tx.amount_usd.toFixed(2)}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
