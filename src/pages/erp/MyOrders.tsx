import { useEffect, useState } from 'react'
import { Package, Smartphone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { getMyERPOrders } from '@/lib/db'
import type { ERPOrder, ERPOrderStatus } from '@/lib/supabase'
import { ERP_COUNTRY_INFO } from '@/lib/supabase'
import { getPaymentMethodLabel } from '@/lib/paymentMethods'

const STATUS_PIPELINE: { key: ERPOrderStatus; label: string; color: string; icon: string }[] = [
  { key: 'draft',         label: 'Brouillon',     color: 'bg-secondary text-secondary-foreground', icon: '📝' },
  { key: 'confirmed',     label: 'Confirmée',     color: 'bg-blue-500/15 text-blue-600',          icon: '✅' },
  { key: 'in_production', label: 'Production',    color: 'bg-yellow-500/15 text-yellow-700',      icon: '🏭' },
  { key: 'shipped',       label: 'Expédiée',      color: 'bg-purple-500/15 text-purple-600',      icon: '📦' },
  { key: 'in_transit',    label: 'En transit',    color: 'bg-orange-500/15 text-orange-600',      icon: '🚢' },
  { key: 'customs',       label: 'En douane',     color: 'bg-pink-500/15 text-pink-600',          icon: '🏛️' },
  { key: 'delivered',     label: 'Livrée',        color: 'bg-primary/15 text-primary',            icon: '🎉' },
  { key: 'returned',      label: 'Retournée',     color: 'bg-destructive/15 text-destructive',    icon: '↩️' },
  { key: 'cancelled',     label: 'Annulée',       color: 'bg-destructive/15 text-destructive',    icon: '❌' },
]

export default function MyOrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<ERPOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getMyERPOrders(user.id).then(setOrders).catch(console.error).finally(() => setLoading(false))
  }, [user])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold">🛒 Mes commandes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {orders.length} commande{orders.length !== 1 ? 's' : ''} · {orders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status)).length} en cours
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />
          Chargement...
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune commande pour l'instant</p>
          <p className="text-xs text-muted-foreground mt-1">Vos commandes apparaissent ici une fois qu'un devis est accepté et converti par un conseiller BizKey.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map(order => {
            const st = STATUS_PIPELINE.find(s => s.key === order.status)
            const country = ERP_COUNTRY_INFO[order.destination_country]
            return (
              <Card key={order.id}>
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{order.product_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{order.order_number}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${st?.color}`}>{st?.icon} {st?.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{country?.flag ?? '🌍'} {country?.label ?? order.destination_country}</span>
                    <span>{order.quantity} × {order.unit_price.toLocaleString()} {order.currency}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-bold text-sm text-primary">{order.total_amount.toLocaleString()} {order.currency}</span>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${order.is_paid ? 'border-primary/30 text-primary' : 'border-yellow-500/40 text-yellow-600'}`}>
                      <Smartphone className="h-3 w-3" />
                      {order.is_paid ? 'Payé' : getPaymentMethodLabel(order.payment_method)}
                    </Badge>
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
