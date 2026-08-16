import paymentMethods from '@/lib/payment/config/payment_methods.json'
import type { ERPCountry } from '@/lib/supabase'

export interface PaymentMethodOption {
  id: string
  name: string
  provider: string
  color: string
  active: boolean
}

// payment_methods.json keys don't match ERPCountry 1:1 (e.g. "cote_ivoire" vs
// "cote_divoire"), and mali/niger have no mobile money coverage configured yet.
const COUNTRY_KEY_MAP: Record<ERPCountry, keyof typeof paymentMethods | null> = {
  benin: 'benin',
  togo: 'togo',
  senegal: 'senegal',
  cote_divoire: 'cote_ivoire',
  cameroun: 'cameroun',
  mali: null,
  niger: null,
}

export function getPaymentMethodsForCountry(country: ERPCountry): PaymentMethodOption[] {
  const key = COUNTRY_KEY_MAP[country]
  if (!key) return []
  return paymentMethods[key]?.methods ?? []
}

const ALL_METHODS: PaymentMethodOption[] = Object.values(paymentMethods).flatMap(c => c.methods)

export function getPaymentMethodLabel(methodId: string | null): string {
  if (!methodId) return 'Non renseigné'
  return ALL_METHODS.find(m => m.id === methodId)?.name ?? methodId
}

export function getPaymentMethodColor(methodId: string | null): string {
  if (!methodId) return '#94a3b8'
  return ALL_METHODS.find(m => m.id === methodId)?.color ?? '#94a3b8'
}
