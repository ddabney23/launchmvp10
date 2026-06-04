import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/integrations/supabase/types'

const fallbackSupabaseUrl = 'http://localhost:54321'
const fallbackSupabaseAnonKey = 'supabase-anon-key-not-configured'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey
  )
}
