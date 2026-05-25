/**
 * Session Management Utilities
 * Supabase Auth + profiles (profiles.id = auth.users.id)
 */

import { createClient } from '@/lib/supabase/server'

export interface SessionUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: 'user' | 'vendor' | 'admin'
  isVendor: boolean
  isAdmin: boolean
  vendorVerified: boolean
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return {
        id: user.id,
        email: user.email || '',
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
        displayName: user.user_metadata?.display_name || 'User',
        avatarUrl: (user.user_metadata?.avatar_url as string) || null,
        role: 'user',
        isVendor: false,
        isAdmin: false,
        vendorVerified: false,
      }
    }

    let role: 'user' | 'vendor' | 'admin' = 'user'
    if (profile.is_admin) {
      role = 'admin'
    } else if (profile.is_vendor && profile.vendor_verified) {
      role = 'vendor'
    }

    return {
      id: profile.id,
      email: profile.email || user.email || '',
      username: profile.username,
      displayName: profile.display_name || profile.username,
      avatarUrl: profile.avatar_url,
      role,
      isVendor: profile.is_vendor,
      isAdmin: profile.is_admin || false,
      vendorVerified: profile.vendor_verified,
    }
  } catch (error) {
    console.error('getSession error:', error)
    return null
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
