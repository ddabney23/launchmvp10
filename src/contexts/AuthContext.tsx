'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/integrations/supabase/client'
import { getProfile } from '@/lib/api'
import { logger } from '@/lib/logger'
import type { Profile } from '@/lib/types'

export type AuthUser = {
  id: string
  email: string
  emailVerified: boolean
  imageUrl?: string
  username?: string
}

type AuthContextValue = {
  user: AuthUser | null
  session: { user: User } | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  isAuthenticated: boolean
  getProfileUuid: () => Promise<string | null>
  refetch: () => Promise<void>
  setProfile: (profile: Profile | null) => void
  mergeProfile: (partial: Partial<Profile>) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user: User) => {
    try {
      const profileData = await getProfile(user.id)
      setProfile(profileData)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const nextUser = session?.user ?? null
        setAuthUser(nextUser)
        if (nextUser) {
          loadProfile(nextUser).finally(() => setLoading(false))
        } else {
          setProfile(null)
          setLoading(false)
        }
      })
      .catch((error) => {
        logger.warn('Failed to load auth session (non-critical)', {
          error: error instanceof Error ? error.message : String(error),
        })
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setAuthUser(nextUser)
      if (nextUser) {
        loadProfile(nextUser)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const user = useMemo((): AuthUser | null => {
    if (!authUser) return null
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      emailVerified: !!authUser.email_confirmed_at,
      imageUrl: authUser.user_metadata?.avatar_url as string | undefined,
      username: authUser.user_metadata?.username as string | undefined,
    }
  }, [
    authUser?.id,
    authUser?.email,
    authUser?.email_confirmed_at,
    authUser?.user_metadata?.avatar_url,
    authUser?.user_metadata?.username,
  ])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setAuthUser(null)
    setProfile(null)
    router.push('/auth')
  }, [router])

  const getProfileUuid = useCallback(async () => authUser?.id ?? null, [authUser?.id])

  const refetch = useCallback(async () => {
    if (authUser) await loadProfile(authUser)
  }, [authUser, loadProfile])

  const setProfileState = useCallback((next: Profile | null) => {
    setProfile(next)
  }, [])

  const mergeProfile = useCallback((partial: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...partial } : null))
  }, [])

  const value = useMemo(
    (): AuthContextValue => ({
      user,
      session: authUser ? { user: authUser } : null,
      profile,
      loading,
      signOut,
      isAuthenticated: !!authUser,
      getProfileUuid,
      refetch,
      setProfile: setProfileState,
      mergeProfile,
    }),
    [user, authUser, profile, loading, signOut, getProfileUuid, refetch, setProfileState, mergeProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
