import { Suspense } from 'react'
import { AuthPageClient } from '../AuthPageClient'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageClient mode="sign-up" />
    </Suspense>
  )
}
