import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/integrations/supabase/types'
import { getSupabaseAnonKey, getSupabaseUrl } from './config'

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey()
  )
}
