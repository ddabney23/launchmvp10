import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/integrations/supabase/types'

const BUILD_SAFE_SUPABASE_URL = 'http://127.0.0.1:54321'
const BUILD_SAFE_SUPABASE_ANON_KEY = 'build-placeholder-anon-key'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || BUILD_SAFE_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || BUILD_SAFE_SUPABASE_ANON_KEY
  )
}
