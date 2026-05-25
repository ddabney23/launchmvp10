import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from './types'

export const supabase = createBrowserSupabaseClient()

export { createBrowserSupabaseClient as createClient }
