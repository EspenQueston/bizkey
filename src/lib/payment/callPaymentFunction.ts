import { supabase } from '@/lib/supabase'
import type { ProviderName } from './PaymentGatewayInterface'

type PaymentFunctionAction = 'initiate' | 'status'

interface PaymentFunctionBody {
  action: PaymentFunctionAction
  provider: ProviderName
  amount?: number
  currency?: string
  transactionId?: string
  description?: string
  phoneNumber?: string
  countryCode?: string
  returnUrl?: string
  notifyUrl?: string
  metadata?: Record<string, string>
}

const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 700

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(status: number) {
  return status === 429 || status >= 500
}

export async function callPaymentFunction<T>(body: PaymentFunctionBody): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Non authentifié')
  }

  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment`

  let attempt = 0
  let lastError: Error | null = null

  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string; message?: string } | null
        const message = payload?.error ?? payload?.message ?? `Paiement indisponible (${res.status})`

        if (attempt < MAX_RETRIES && shouldRetry(res.status)) {
          attempt += 1
          await sleep(RETRY_BASE_DELAY_MS * attempt)
          continue
        }

        throw new Error(message)
      }

      return res.json() as Promise<T>
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Erreur réseau de paiement')

      if (attempt < MAX_RETRIES) {
        attempt += 1
        await sleep(RETRY_BASE_DELAY_MS * attempt)
        continue
      }

      break
    }
  }

  throw new Error(lastError?.message ?? 'Paiement indisponible')
}
