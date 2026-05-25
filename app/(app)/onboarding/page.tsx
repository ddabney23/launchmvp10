'use client'

// CLERK MIGRATION: New onboarding funnel with Vendor/Customer selection
import { Suspense } from 'react'
import OnboardingFunnel from '@/views/OnboardingFunnel'
import { Loader2 } from 'lucide-react'

function OnboardingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingFunnel />
    </Suspense>
  )
}
