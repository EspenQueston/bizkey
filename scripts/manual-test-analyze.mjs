import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const urls = [
  'https://e.tb.cn/h.iGmLoTyBbUbrCgS?tk=wWE55j7bEos',
  'https://e.tb.cn/h.iGmHU88bVezSkF4?tk=4KGq5j7WyNa',
]

const supabase = createClient(supabaseUrl, anonKey)

async function callAnalyzeFree(url) {
  const res = await fetch(`${supabaseUrl}/functions/v1/analyze-free`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'url', value: url }),
  })

  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function getSession() {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) return null

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error && signIn.data.session) return signIn.data.session

  await supabase.auth.signUp({ email, password })
  const signInAgain = await supabase.auth.signInWithPassword({ email, password })
  if (signInAgain.error || !signInAgain.data.session) {
    throw new Error(`Cannot authenticate TEST user: ${signInAgain.error?.message ?? 'unknown'}`)
  }

  return signInAgain.data.session
}

async function callAnalyze(url, accessToken) {
  const res = await fetch(`${supabaseUrl}/functions/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ productUrl: url }),
  })

  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

for (const url of urls) {
  const free = await callAnalyzeFree(url)
  console.log('\n[analyze-free]', url)
  console.log('status:', free.status)
  console.log('keys:', Object.keys(free.body ?? {}))
  if (free.body?.report) {
    console.log('report.product_name:', free.body.report.product_name)
    console.log('report.data_source:', free.body.report.data_source)
    console.log('report.price_min/max:', free.body.report.price_min, free.body.report.price_max)
  } else {
    console.log('body:', free.body)
  }
}

const session = await getSession()
if (!session) {
  console.log('\n[analyze] skipped: TEST_EMAIL/TEST_PASSWORD not provided')
  process.exit(0)
}

for (const url of urls) {
  const paid = await callAnalyze(url, session.access_token)
  console.log('\n[analyze]', url)
  console.log('status:', paid.status)
  console.log('keys:', Object.keys(paid.body ?? {}))
  if (paid.body?.analysis) {
    const a = paid.body.analysis
    console.log('analysis.product_name:', a.product_name)
    console.log('analysis.data_source:', a.data_source)
    console.log('analysis.ai_source:', a.ai_source)
    console.log('analysis.fallback_reason:', a.fallback_reason)
    console.log('analysis.confidence_score:', a.confidence_score)
  } else {
    console.log('body:', paid.body)
  }
}
