/**
 * Server-side Supabase clients — delegates to @supabase/ssr helpers.
 */

import { createClient as createSupabaseServerClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase/server'
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/config'
import type { Database } from './types'

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function createServerClient() {
  return createSSRClient()
}

/** Alias used by API routes */
export const createClient = createServerClient

export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations.'
    )
  }

  return createSupabaseServerClient<Database>(
    getSupabaseUrl(),
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export function createClientFromRequest(authHeader?: string | null) {
  return createSupabaseServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  })
}
