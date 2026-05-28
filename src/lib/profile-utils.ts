import type { Profile } from '@/lib/types'

/** True only when the database flag is explicitly set. */
export function isOnboardingComplete(
  profile: Pick<Profile, 'onboarding_completed'> | null | undefined
): boolean {
  return profile?.onboarding_completed === true
}

/** Client-side fallback when Supabase read fails — never treated as onboarding complete. */
export function createMinimalProfileFallback(userId: string): Profile {
  return {
    id: userId,
    username: `user_${userId.substring(0, 8)}`,
    display_name: 'User',
    email: '',
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
    is_vendor: false,
    vendor_verified: false,
    onboarding_completed: false,
    credits: 0,
    points: 0,
  }
}
