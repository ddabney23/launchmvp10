'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SupabaseAuthForm } from '@/components/auth/SupabaseAuthForm'
import { isAdminEmail } from '@/lib/admin'
import { getProfile } from '@/lib/api'
import { getPostAuthRedirectPath } from '@/lib/auth-redirect'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const checkTimeout = window.setTimeout(() => setChecking(false), 8000)

    const redirectIfSignedIn = async (userId: string, email?: string | null) => {
      const isEmailAdmin = isAdminEmail(email ?? undefined)
      let profile = null
      try {
        profile = await getProfile(userId)
      } catch {
        // no profile row yet
      }
      const path = getPostAuthRedirectPath(profile, {
        redirectUrl: searchParams.get('redirect_url'),
        isEmailAdmin,
      })
      router.push(path)
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session?.user) {
        void redirectIfSignedIn(session.user.id, session.user.email)
      } else {
        setChecking(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        void redirectIfSignedIn(session.user.id, session.user.email)
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

  const isSignUp = pathname?.includes('/sign-up')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <SupabaseAuthForm mode={isSignUp ? 'sign-up' : 'sign-in'} />
    </div>
  )
}
