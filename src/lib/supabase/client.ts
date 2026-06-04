import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

export type BrowserSupabaseClient = SupabaseClient<Database>

function getSupabaseConfig(
  supabaseUrl: string | undefined,
  supabaseAnonKey: string | undefined
): { supabaseUrl: string; supabaseAnonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

export function createClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
): BrowserSupabaseClient {
  const config = getSupabaseConfig(supabaseUrl, supabaseAnonKey)

  return createBrowserClient<Database>(
    config.supabaseUrl,
    config.supabaseAnonKey
  )
}
