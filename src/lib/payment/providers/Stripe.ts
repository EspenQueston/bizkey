// Stripe Provider — International credit/debit card payments
// Docs: https://stripe.com/docs
// Keys are passed server-side via Supabase Edge Function.

import type { PaymentGatewayInterface, InitiatePaymentParams, TransactionResult, PaymentStatus, WebhookResult } from '../PaymentGatewayInterface'
import { callPaymentFunction } from '../callPaymentFunction'

export class StripeProvider implements PaymentGatewayInterface {
  readonly name = 'stripe'

  async initiatePayment(params: InitiatePaymentParams): Promise<TransactionResult> {
    return callPaymentFunction<TransactionResult>({
      action: 'initiate',
      provider: 'stripe',
      amount: params.amount,
      currency: params.currency,
      transactionId: crypto.randomUUID(),
      description: params.description,
      phoneNumber: params.phone,
      countryCode: params.countryCode,
      metadata: params.metadata,
    })
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    return callPaymentFunction<PaymentStatus>({
      action: 'status',
      provider: 'stripe',
      transactionId,
    })
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    console.warn('handleWebhook should be called server-side only')
    return { transactionId: '', status: 'pending', rawPayload: payload }
  }
}
