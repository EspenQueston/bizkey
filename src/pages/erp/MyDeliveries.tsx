import { useEffect, useState } from 'react'
import { Truck, Package, MapPin, Clock, Smartphone, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { getMyERPDeliveries, getMyERPOrders } from '@/lib/db'
import type { ERPDelivery, ERPOrder, ERPDeliveryStatus } from '@/lib/supabase'
import { ERP_COUNTRY_INFO } from '@/lib/supabase'
import { getPaymentMethodLabel } from '@/lib/paymentMethods'

const STATUS_META: Record<ERPDeliveryStatus, { label: string; color: string; icon: string }> = {
  pending:    { label: 'En attente',    color: 'bg-secondary text-muted-foreground',   icon: '⏳' },
  dispatched: { label: 'Expédiée',      color: 'bg-blue-500/15 text-blue-600',         icon: '📦' },
  in_transit: { label: 'En transit',    color: 'bg-orange-500/15 text-orange-600',     icon: '🚢' },
  customs:    { label: 'En douane',     color: 'bg-yellow-500/15 text-yellow-700',     icon: '🏛️' },
  delivered:  { label: 'Livrée',        color: 'bg-primary/15 text-primary',           icon: '✅' },
  returned:   { label: 'Retournée',     color: 'bg-destructive/15 text-destructive',   icon: '↩️' },
}

const DELIVERY_STEPS: ERPDeliveryStatus[] = ['pending', 'dispatched', 'in_transit', 'customs', 'delivered']

export default function MyDeliveriesPage() {
  const { user } = useAuth()
  const [deliveries, setDeliveries] = useState<ERPDelivery[]>([])
  const [orders, setOrders] = useState<ERPOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.allSettled([getMyERPDeliveries(), getMyERPOrders(user.id)]).then(([d, o]) => {
      if (d.status === 'fulfilled') setDeliveries(d.value)
      if (o.status === 'fulfilled') setOrders(o.value)
    }).finally(() => setLoading(false))
  }, [user])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-bold">🚚 Mes livraisons</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {deliveries.filter(d => d.status === 'in_transit').length} en transit ·
          {' '}{deliveries.filter(d => d.status === 'customs').length} en douane ·
          {' '}{deliveries.filter(d => d.status === 'delivered').length} livrées
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-3" />Chargement...
        </div>
      ) : deliveries.length === 0 ? (
        <div className="py-16 text-center">
          <Truck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune livraison pour l'instant</p>
          <p className="text-xs text-muted-foreground mt-1">Le suivi apparaît ici une fois votre commande expédiée.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(delivery => {
            const meta = STATUS_META[delivery.status]
            const country = ERP_COUNTRY_INFO[delivery.destination_country]
            const order = orders.find(o => o.id === delivery.order_id)
            const stepIdx = DELIVERY_STEPS.indexOf(delivery.status)
            const nextStep = stepIdx >= 0 && stepIdx < DELIVERY_STEPS.length - 1 ? DELIVERY_STEPS[stepIdx + 1] : null
            const blockedByPayment = nextStep === 'dispatched' && order && !order.is_paid
            return (
              <Card key={delivery.id} className={`${delivery.status === 'in_transit' || delivery.status === 'customs' ? 'border-orange-500/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xl">{country?.flag ?? '🌍'}</span>
                      <span className="font-semibold text-sm">{order?.product_name ?? delivery.order_id.slice(0, 8)}</span>
                      <Badge className={`text-xs ${meta.color}`}>{meta.icon} {meta.label}</Badge>
                      {order && (
                        <Badge variant="outline" className={`text-xs gap-1 ${order.is_paid ? 'border-primary/30 text-primary' : 'border-yellow-500/40 text-yellow-600'}`}>
                          <Smartphone className="h-3 w-3" />
                          {getPaymentMethodLabel(order.payment_method)} · {order.is_paid ? 'Payé' : 'Non payé'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {delivery.tracking_number && (
                        <span className="flex items-center gap-1.5 font-mono">
                          <Package className="h-3 w-3" />{delivery.tracking_number}
                        </span>
                      )}
                      {delivery.carrier && <span className="flex items-center gap-1.5"><Truck className="h-3 w-3" />{delivery.carrier}</span>}
                      <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{country?.label ?? delivery.destination_country}{delivery.destination_city ? `, ${delivery.destination_city}` : ''}</span>
                      {delivery.estimated_days && <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />~{delivery.estimated_days} jours</span>}
                    </div>
                    {blockedByPayment && (
                      <p className="mt-1.5 text-xs text-yellow-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" />
                        En attente de confirmation de paiement avant expédition.
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-1">
                      {DELIVERY_STEPS.map((step, i) => {
                        const done = DELIVERY_STEPS.indexOf(delivery.status) >= i
                        return (
                          <div key={step} className="flex items-center flex-1">
                            <div className={`h-2 flex-1 rounded-full transition-all ${done ? 'bg-primary' : 'bg-border'}`} />
                            {i < DELIVERY_STEPS.length - 1 && <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? 'bg-primary' : 'bg-border'}`} />}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between mt-0.5 text-xs text-muted-foreground/60">
                      <span>⏳ Attente</span><span>📦 Expédiée</span><span>🚢 Transit</span><span>🏛️ Douane</span><span>✅ Livré</span>
                    </div>
                  </div>

                  {/* Country customs info */}
                  {country && (
                    <div className="mt-3 p-2.5 rounded-lg bg-secondary/40 border border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>⚓ Mer: <strong>{country.avgSeaDays}j</strong></span>
                      <span>✈️ Air: <strong>{country.avgAirDays}j</strong></span>
                      <span>🏙️ Capital: <strong>{country.capital}</strong></span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
