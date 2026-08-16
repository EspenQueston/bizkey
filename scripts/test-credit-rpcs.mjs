import { createClient } from '@supabase/supabase-js'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function run() {
  const supabase = createClient(
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const userId = required('TEST_USER_ID')

  const before = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  if (before.error) throw before.error

  assert(before.data && typeof before.data === 'object', 'get_credit_balance should return an object')
  assert(typeof before.data.total_basic === 'number', 'total_basic should be number')
  assert(typeof before.data.total_advanced === 'number', 'total_advanced should be number')

  const basic = await supabase.rpc('consume_basic_credit', {
    p_user_id: userId,
    p_feature: 'rpc_test_basic',
  })
  if (basic.error) throw basic.error
  assert(typeof basic.data?.success === 'boolean', 'consume_basic_credit should return success boolean')

  const advanced = await supabase.rpc('consume_advanced_credit', {
    p_user_id: userId,
    p_feature: 'rpc_test_advanced',
  })
  if (advanced.error) throw advanced.error
  assert(typeof advanced.data?.success === 'boolean', 'consume_advanced_credit should return success boolean')

  const after = await supabase.rpc('get_credit_balance', { p_user_id: userId })
  if (after.error) throw after.error

  assert(after.data && typeof after.data === 'object', 'get_credit_balance (after) should return an object')

  console.log('RPC credit tests passed')
  console.log({ before: before.data, basic: basic.data, advanced: advanced.data, after: after.data })
}

run().catch((err) => {
  console.error('RPC credit tests failed:', err)
  process.exit(1)
})
