'use client'

// CLERK MIGRATION: Legacy Auth component - redirects to new catch-all route
// This is kept for backward compatibility with /login and /register routes
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function Auth() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Redirect to the new catch-all auth route
    if (pathname === '/register') {
      router.replace('/auth/sign-up')
    } else if (pathname === '/login') {
      router.replace('/auth')
    } else {
      router.replace('/auth')
    }
  }, [pathname, router])

  return null
}
