const path = require('path')
const dotenv = require('dotenv')

const root = path.join(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

console.log('Checking env...')
const missing = required.filter((v) => !process.env[v])
if (missing.length) {
  console.error('Missing:', missing.join(', '))
  process.exit(1)
}
console.log('All required env vars present')
