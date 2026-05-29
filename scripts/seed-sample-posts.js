/**
 * Seed sample public posts for local/dev feed testing.
 *
 * Usage:
 *   node scripts/seed-sample-posts.js
 *   node scripts/seed-sample-posts.js <profile-uuid>
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

const SAMPLE_POSTS = [
  'Welcome to Optimix! This is a sample public post for the feed.',
  'Discover vendors, share updates, and connect with your community.',
  'Tip: create your own post from the Feed or Create page after onboarding.',
]

async function resolveAuthorId(cli, argId) {
  if (argId) {
    const { data } = await cli.from('profiles').select('id').eq('id', argId).maybeSingle()
    if (data?.id) return data.id
    console.warn(`Profile ${argId} not found, picking another profile.`)
  }

  const { data: profiles, error } = await cli
    .from('profiles')
    .select('id, username')
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error || !profiles?.length) {
    throw new Error('No profiles found. Complete onboarding or create a user first.')
  }

  return profiles[0].id
}

async function main() {
  const authorId = await resolveAuthorId(supabase, process.argv[2])

  const rows = SAMPLE_POSTS.map((content) => ({
    author: authorId,
    content,
    visibility: 'public',
    media_urls: [],
  }))

  const { data, error } = await supabase.from('posts').insert(rows).select('id, content')

  if (error) {
    console.error('Failed to seed posts:', error.message)
    process.exit(1)
  }

  console.log(`Seeded ${data.length} public post(s) for author ${authorId}:`)
  data.forEach((p) => console.log(`  - ${p.id}: ${p.content.slice(0, 60)}...`))
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
