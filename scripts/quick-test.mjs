import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testing Supabase with Service Role...\n')
console.log('URL:', supabaseUrl)
console.log('Service Key:', serviceKey ? `${serviceKey.substring(0, 20)}...` : 'MISSING')
console.log('')

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test 1: List tables
console.log('Test 1: Querying profiles table...')
const { data, error, count } = await supabase
  .from('profiles')
  .select('*', { count: 'exact' })
  .limit(5)

if (error) {
  console.error('❌ Error:', error.message)
  console.error('Code:', error.code)
  console.error('Details:', error.details)
  console.error('Hint:', error.hint)
} else {
  console.log(`✅ Success! Found ${count} total profiles`)
  console.log('Sample data:', data?.length, 'profiles')
}
