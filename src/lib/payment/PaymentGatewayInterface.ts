// Payment Gateway Strategy Pattern — Interface
// Swap providers by changing config, not code.

export interface TransactionResult {
  success: boolean
  transactionId: string | null
  paymentUrl?: string       // redirect URL for web checkout (Stripe, etc.)
  ussdCode?: string         // USSD prompt for mobile money
  message?: string
  rawResponse?: unknown
}

export interface PaymentStatus {
  transactionId: string
  status: 'pending' | 'success' | 'failed' | 'refunded'
  paidAt?: string
  rawResponse?: unknown
}

export interface WebhookResult {
  transactionId: string
  status: 'pending' | 'success' | 'failed' | 'refunded'
  userId?: string
  planId?: string
  rawPayload: unknown
}

export interface InitiatePaymentParams {
  amount: number          // in local currency
  currency: string        // 'XOF', 'XAF', 'USD'
  phone: string
  countryCode: string     // 'BJ', 'SN', 'CI', etc.
  method: string          // 'orange_ci', 'wave_sn', etc.
  description: string
  metadata?: Record<string, string>
}

export interface PaymentGatewayInterface {
  readonly name: string

  initiatePayment(params: InitiatePaymentParams): Promise<TransactionResult>
  checkPaymentStatus(transactionId: string): Promise<PaymentStatus>
  handleWebhook(payload: unknown, signature?: string): Promise<WebhookResult>
}

// ─── Active Provider Selector ──────────────────────────────────────────────────
// Change VITE_PAYMENT_PROVIDER env var to switch: 'fedapay' | 'stripe'
// CinetPay support was removed (for now) — see FedaPay.ts / Stripe.ts.

export type ProviderName = 'fedapay' | 'stripe'

export function getActiveProvider(): ProviderName {
  const env = import.meta.env.VITE_PAYMENT_PROVIDER as string | undefined
  const valid: ProviderName[] = ['fedapay', 'stripe']
  return (valid.includes(env as ProviderName) ? env : 'fedapay') as ProviderName
}
