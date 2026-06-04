import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

export type BrowserSupabaseClient = SupabaseClient<Database>

function assertSupabaseConfig(
  supabaseUrl: string | undefined,
  supabaseAnonKey: string | undefined
) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
}

export function createClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
): BrowserSupabaseClient {
  assertSupabaseConfig(supabaseUrl, supabaseAnonKey)

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  )
}
