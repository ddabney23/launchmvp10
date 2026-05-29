'use client'

// CLERK MIGRATION: New onboarding funnel - Step 1: Choose Vendor or Customer
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Store, Users, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getMyProfile } from '@/lib/api'
import { isAdminEmail } from '@/lib/admin'
import { isOnboardingComplete } from '@/lib/profile-utils'

type OnboardingStep = 'choose-role' | 'vendor' | 'customer'

export default function OnboardingFunnel() {
  const router = useRouter()
  const { user, loading: authLoading, refetch } = useAuth()
  const isLoaded = !authLoading
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('choose-role')
  const [selectedRole, setSelectedRole] = useState<'vendor' | 'customer' | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.push('/auth?redirect_url=/onboarding')
      return
    }

    const checkProfile = async () => {
      const email = user.email
      const isEmailAdmin = isAdminEmail(email)

      try {
        await refetch()
      } catch (error) {
        console.log('Profile refetch failed, continuing onboarding:', error)
      }

      let currentProfile = null
      try {
        currentProfile = await getMyProfile()
      } catch (error) {
        console.log('Profile load failed, continuing onboarding:', error)
      }

      const isAdmin = currentProfile?.is_admin || isEmailAdmin

      if (isAdmin) {
        router.push('/admin')
        return
      }

      if (currentProfile && isOnboardingComplete(currentProfile)) {
        if (currentProfile.is_vendor) {
          router.push('/vendor/dashboard')
        } else {
          router.push('/home')
        }
        return
      }

      setLoading(false)
    }

    void checkProfile()
  }, [user?.id, user?.email, isLoaded, router, refetch])

  const handleRoleSelection = (role: 'vendor' | 'customer') => {
    setSelectedRole(role)
    setCurrentStep(role)
  }

  // Handle navigation when step changes
  useEffect(() => {
    if (currentStep === 'vendor') {
      router.push('/onboarding/vendor')
    } else if (currentStep === 'customer') {
      router.push('/onboarding/customer')
    }
  }, [currentStep, router])

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Step 1: Choose Role (Vendor or Customer)
  if (currentStep === 'choose-role') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-4xl shadow-primary animate-scale-in">
          <CardHeader className="space-y-4 text-center">
            <CardTitle className="text-4xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
              Welcome to Optimix! 🎉
            </CardTitle>
            <CardDescription className="text-lg">
              Let's get you started. Choose how you'd like to use Optimix:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              {/* Customer Option */}
              <Card
                className="cursor-pointer hover:shadow-lg transition-all duration-300 border-2 hover:border-primary"
                onClick={() => handleRoleSelection('customer')}
              >
                <CardHeader>
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-center">I'm a Customer</CardTitle>
                  <CardDescription className="text-center mt-2">
                    Discover products, connect with vendors, and join communities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Browse marketplace
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Follow favorite vendors
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Join social communities
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Earn rewards & badges
                    </li>
                  </ul>
                  <Button className="w-full mt-6" onClick={() => handleRoleSelection('customer')}>
                    Get Started as Customer
                  </Button>
                </CardContent>
              </Card>

              {/* Vendor Option */}
              <Card
                className="cursor-pointer hover:shadow-lg transition-all duration-300 border-2 hover:border-primary"
                onClick={() => handleRoleSelection('vendor')}
              >
                <CardHeader>
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-4 rounded-full bg-secondary/10">
                      <Store className="h-12 w-12 text-secondary" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-center">I'm a Vendor</CardTitle>
                  <CardDescription className="text-center mt-2">
                    Sell products, manage your store, and grow your business
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-secondary" />
                      Create product listings
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-secondary" />
                      Manage orders & bookings
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-secondary" />
                      Connect Stripe payments
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-secondary" />
                      Track analytics & sales
                    </li>
                  </ul>
                  <Button
                    className="w-full mt-6 bg-secondary hover:bg-secondary/90"
                    onClick={() => handleRoleSelection('vendor')}
                  >
                    Get Started as Vendor
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Route to appropriate onboarding flow (handled by useEffect)
  if (currentStep === 'vendor' || currentStep === 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-secondary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return null
}

