import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  action: 'initiate' | 'status'
  provider: 'fedapay' | 'stripe'
  // initiate fields
  amount?: number
  currency?: string
  transactionId?: string
  description?: string
  phoneNumber?: string
  countryCode?: string
  returnUrl?: string
  notifyUrl?: string
  metadata?: Record<string, string>
  // status fields — also uses transactionId above
}

interface SystemEventInput {
  user_id?: string
  event_name: string
  service: string
  status: 'ok' | 'warn' | 'error'
  latency_ms?: number
  source?: string
  metadata?: Record<string, unknown>
}

async function logSystemEvent(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  input: SystemEventInput,
) {
  try {
    await supabaseAdmin.from('system_events').insert(input)
  } catch {
    // non-blocking
  }
}

function safeErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function logGatewayError(provider: RequestBody['provider'], action: RequestBody['action'], details: Record<string, unknown>) {
  console.error(`[payment][${provider}][${action}] gateway error`, JSON.stringify(details))
}

// ── FedaPay helpers ────────────────────────────────────────────────────────────

async function fedapayInitiate(body: RequestBody, apiKey: string) {
  const res = await fetch('https://api.fedapay.com/v1/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      description: body.description ?? 'BizKey',
      amount: body.amount,
      currency: { iso: body.currency ?? 'XOF' },
      callback_url: body.returnUrl ?? '',
      customer: { phone_number: { number: body.phoneNumber, country: body.countryCode ?? 'bj' } },
    }),
  })
  const data = await res.json()
  const id = data?.v1_transaction?.id

  if (!id) {
    logGatewayError('fedapay', 'initiate', {
      status: res.status,
      message: data?.message ?? 'No transaction id from FedaPay',
    })
    return { success: false, transactionId: body.transactionId ?? null, message: 'No transaction id from FedaPay', rawResponse: data }
  }

  // request token
  const tokenRes = await fetch(`https://api.fedapay.com/v1/transactions/${id}/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const tokenData = await tokenRes.json()

  if (!tokenData?.url) {
    logGatewayError('fedapay', 'initiate', {
      transactionId: String(id),
      tokenStatus: tokenRes.status,
      message: tokenData?.message ?? 'No payment URL from FedaPay token',
    })
  }

  return {
    success: Boolean(tokenData?.url),
    transactionId: String(id),
    paymentUrl: tokenData?.url,
    rawResponse: tokenData,
  }
}

async function fedapayStatus(transactionId: string, apiKey: string) {
  const res = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const data = await res.json()
  const s = data?.v1_transaction?.status
  const mapped = s === 'approved' ? 'success' : s === 'declined' || s === 'cancelled' ? 'failed' : 'pending'

  if (!res.ok || mapped === 'failed') {
    logGatewayError('fedapay', 'status', {
      transactionId,
      httpStatus: res.status,
      providerStatus: s,
      message: data?.message ?? 'FedaPay status check failed',
    })
  }

  return { transactionId, status: mapped, rawResponse: data }
}

// ── Stripe helpers ─────────────────────────────────────────────────────────────

async function stripeInitiate(body: RequestBody, secretKey: string) {
  const params = new URLSearchParams()
  params.append('payment_method_types[]', 'card')
  params.append('line_items[0][price_data][currency]', (body.currency ?? 'usd').toLowerCase())
  params.append('line_items[0][price_data][product_data][name]', body.description ?? 'BizKey')
  params.append('line_items[0][price_data][unit_amount]', String(Math.round((body.amount ?? 0) * 100)))
  params.append('line_items[0][quantity]', '1')
  params.append('mode', 'payment')
  params.append('success_url', body.returnUrl ?? 'https://localhost:5173/checkout?done=1')
  params.append('cancel_url', body.returnUrl ?? 'https://localhost:5173/checkout?cancelled=1')
  params.append('metadata[transaction_id]', body.transactionId ?? '')

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json()

  if (!data?.url) {
    logGatewayError('stripe', 'initiate', {
      status: res.status,
      message: data?.error?.message ?? 'Stripe checkout session creation failed',
    })
  }

  return {
    success: Boolean(data?.url),
    transactionId: data?.id ?? body.transactionId ?? null,
    paymentUrl: data?.url,
    message: data?.error?.message,
    rawResponse: data,
  }
}

async function stripeStatus(sessionId: string, secretKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  const s = data?.payment_status
  const mapped = s === 'paid' ? 'success' : s === 'no_payment_required' ? 'success' : 'pending'

  if (!res.ok) {
    logGatewayError('stripe', 'status', {
      transactionId: sessionId,
      httpStatus: res.status,
      providerStatus: s,
      message: data?.error?.message ?? 'Stripe status check failed',
    })
  }

  return { transactionId: sessionId, status: mapped, rawResponse: data }
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = Date.now()

  try {
    const body: RequestBody = await req.json()

    // Authenticate request via Supabase JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const provider = body.provider ?? 'fedapay'
    let result: Record<string, unknown>
    let eventStatus: 'ok' | 'warn' | 'error' = 'ok'

    if (body.action === 'initiate') {
      if (provider === 'fedapay') {
        const apiKey = Deno.env.get('FEDAPAY_API_KEY')!
        result = await fedapayInitiate(body, apiKey)
      } else if (provider === 'stripe') {
        const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!
        result = await stripeInitiate(body, secretKey)
      } else {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    } else if (body.action === 'status') {
      if (!body.transactionId) return new Response(JSON.stringify({ error: 'transactionId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (provider === 'fedapay') {
        const apiKey = Deno.env.get('FEDAPAY_API_KEY')!
        result = await fedapayStatus(body.transactionId, apiKey)
      } else if (provider === 'stripe') {
        const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!
        result = await stripeStatus(body.transactionId, secretKey)
      } else {
        return new Response(JSON.stringify({ error: 'Unknown provider' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (result.success === false || result.status === 'failed') {
      eventStatus = 'warn'
    }

    await logSystemEvent(supabase, {
      user_id: user.id,
      event_name: `payment_${body.action}`,
      service: 'payment',
      status: eventStatus,
      latency_ms: Date.now() - startedAt,
      source: provider,
      metadata: {
        transaction_id: body.transactionId ?? null,
        provider_status: result.status ?? null,
        success: result.success ?? null,
      },
    })

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const errorMessage = safeErrorMessage(err)
    console.error('[payment][handler] unhandled error', errorMessage)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await logSystemEvent(supabase, {
      event_name: 'payment_unhandled_error',
      service: 'payment',
      status: 'error',
      latency_ms: Date.now() - startedAt,
      source: 'unknown',
      metadata: { error: errorMessage },
    })

    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
