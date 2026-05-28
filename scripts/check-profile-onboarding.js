/**
 * Query profiles.onboarding_completed directly via Supabase service role.
 *
 * Usage:
 *   node scripts/check-profile-onboarding.js
 *   node scripts/check-profile-onboarding.js <auth-user-uuid>
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const FIELDS =
  'id, email, username, display_name, onboarding_completed, is_vendor, vendor_verified, updated_at'

async function showProfile(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(FIELDS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }

  if (!profile) {
    console.error(`No profile row for id: ${userId}`)
    process.exit(1)
  }

  console.log('\nProfile (direct Supabase query):')
  console.table([
    {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      display_name: profile.display_name,
      onboarding_completed: profile.onboarding_completed,
      is_vendor: profile.is_vendor,
      vendor_verified: profile.vendor_verified,
      updated_at: profile.updated_at,
    },
  ])

  if (profile.onboarding_completed === true) {
    console.log('\nOnboarding status: COMPLETE (onboarding_completed = true)')
  } else {
    console.log(
      '\nOnboarding status: INCOMPLETE (onboarding_completed is false or null)'
    )
  }
}

async function listRecent(limit = 10) {
  const { data, error } = await supabase
    .from('profiles')
    .select(FIELDS)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error('List error:', error.message)
    process.exit(1)
  }

  console.log(`\nRecent profiles (last ${limit} by updated_at):`)
  console.table(
    (data || []).map((p) => ({
      id: p.id,
      email: p.email,
      username: p.username,
      onboarding_completed: p.onboarding_completed,
      updated_at: p.updated_at,
    }))
  )
  console.log('\nPass a user id: node scripts/check-profile-onboarding.js <uuid>')
}

async function main() {
  const userId = process.argv[2]
  if (userId) {
    await showProfile(userId)
  } else {
    await listRecent()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
