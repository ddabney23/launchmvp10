'use client'

// CLERK MIGRATION: Updated to use Clerk authentication
/**
 * Protected Route Component
 * Wraps routes that require authentication
 */

import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import { isAdminEmail } from '@/lib/admin'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading) {
      // Redirect to auth if not signed in
      if (!user) {
        router.push(`/auth?redirect_url=${encodeURIComponent(pathname)}`)
        return
      }

      // Check admin requirement
      if (requireAdmin) {
        const isAdmin = profile?.is_admin || isAdminEmail(user.email)
        if (!isAdmin) {
          router.push('/home')
          return
        }
      }
    }
  }, [user?.id, user?.email, profile?.id, profile?.is_admin, loading, requireAdmin, router, pathname])

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Don't render children if not authenticated or not admin (when required)
  if (!user) {
    return null
  }

  if (requireAdmin) {
    const isAdmin = profile?.is_admin || isAdminEmail(user.email)
    if (!isAdmin) {
      return null
    }
  }

  return <>{children}</>
}
