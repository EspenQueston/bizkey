// CinetPay Provider — Primary Mobile Money Gateway for West Africa
// Docs: https://docs.cinetpay.com
// Keys are passed server-side via Supabase Edge Function — never exposed on client.

import type { PaymentGatewayInterface, InitiatePaymentParams, TransactionResult, PaymentStatus, WebhookResult } from '../PaymentGatewayInterface'
import { callPaymentFunction } from '../callPaymentFunction'

export class CinetPayProvider implements PaymentGatewayInterface {
  readonly name = 'cinetpay'

  async initiatePayment(params: InitiatePaymentParams): Promise<TransactionResult> {
    return callPaymentFunction<TransactionResult>({
      action: 'initiate',
      provider: 'cinetpay',
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
      provider: 'cinetpay',
      transactionId,
    })
  }

  async handleWebhook(payload: unknown, _signature?: string): Promise<WebhookResult> {
    // Webhook handling is done entirely in the Edge Function
    // This client-side method is a no-op and should not be called from browser code
    console.warn('handleWebhook should be called server-side only')
    return {
      transactionId: '',
      status: 'pending',
      rawPayload: payload,
    }
  }
}
