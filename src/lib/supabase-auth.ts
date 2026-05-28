/**
 * Supabase Authentication Helpers for API Routes
 */

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function getAuthUserId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user.id
}

export async function getAuthUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  return user
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await getAuthUserId()
    return true
  } catch {
    return false
  }
}

/**
 * Require an authenticated admin (profiles.is_admin).
 * Use in app/api/admin/** routes instead of duplicating checks.
 */
export async function requireAdminUserId(): Promise<string> {
  const userId = await getAuthUserId()
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error || !profile?.is_admin) {
    throw new Error('Forbidden')
  }

  return userId
}
