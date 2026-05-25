'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { getProfile } from '@/lib/api'
import type { Profile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (authUser: User) => {
    try {
      const profileData = await getProfile(authUser.id)
      setProfile(profileData)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        loadProfile(authUser).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        loadProfile(authUser)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/auth')
  }

  return {
    user: user
      ? {
          id: user.id,
          email: user.email ?? '',
          emailVerified: !!user.email_confirmed_at,
          imageUrl: user.user_metadata?.avatar_url as string | undefined,
          username: user.user_metadata?.username as string | undefined,
        }
      : null,
    session: user ? { user } : null,
    profile,
    loading,
    signOut,
    isAuthenticated: !!user,
    getProfileUuid: async () => user?.id ?? null,
    refetch: async () => {
      if (user) await loadProfile(user)
    },
  }
}
