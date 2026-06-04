'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SupabaseAuthForm } from '@/components/auth/SupabaseAuthForm'
import { getProfile } from '@/lib/api'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

interface AuthPageClientProps {
  mode: 'sign-in' | 'sign-up'
}

export function AuthPageClient({ mode }: AuthPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const checkTimeout = window.setTimeout(() => setChecking(false), 8000)

    const redirectIfSignedIn = async (userId: string) => {
      try {
        try {
          const profile = await getProfile(userId)
          if (profile?.is_admin) {
            router.push('/admin')
            return
          }
        } catch {}
        router.push(searchParams.get('redirect_url') || '/onboarding')
      } catch {
        router.push(searchParams.get('redirect_url') || '/onboarding')
      }
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        void redirectIfSignedIn(session.user.id)
      } else {
        setChecking(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        void redirectIfSignedIn(session.user.id)
      } else {
        setChecking(false)
      }
    })

    return () => {
      window.clearTimeout(checkTimeout)
      subscription.unsubscribe()
    }
  }, [router, searchParams])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <SupabaseAuthForm mode={mode} />
    </div>
  )
}
