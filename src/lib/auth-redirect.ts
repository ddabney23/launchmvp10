import type { Profile } from '@/lib/types'
import { isOnboardingComplete } from '@/lib/profile-utils'

/**
 * Post-login / post-OAuth destination for a signed-in user.
 */
export function getPostAuthRedirectPath(
  profile: Profile | null | undefined,
  options?: { redirectUrl?: string | null; isEmailAdmin?: boolean }
): string {
  if (options?.isEmailAdmin || profile?.is_admin) {
    return '/admin'
  }

  if (profile && isOnboardingComplete(profile)) {
    return profile.is_vendor ? '/vendor/dashboard' : '/home'
  }

  const requested = options?.redirectUrl
  if (requested && requested.startsWith('/') && !requested.startsWith('//')) {
    return requested
  }

  return '/onboarding'
}
