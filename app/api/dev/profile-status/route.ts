/**
 * Development-only: read onboarding/profile state directly from Supabase.
 * GET /api/dev/profile-status
 *
 * Requires an authenticated session (same cookies as the app).
 * Returns 404 in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUser, getAuthUserId } from '@/lib/supabase-auth'
import { productionDisabledResponse } from '@/lib/dev-only'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const disabled = productionDisabledResponse()
  if (disabled) return disabled

  try {
    const userId = await getAuthUserId()
    const authUser = await getAuthUser()

    const admin = createAdminClient()
    const { data: profile, error } = await admin
      .from('profiles')
      .select(
        'id, email, username, display_name, avatar_url, bio, onboarding_completed, is_vendor, vendor_verified, is_admin, points, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          authUserId: userId,
        },
        { status: 500 }
      )
    }

    const onboardingComplete = profile?.onboarding_completed === true

    return NextResponse.json({
      success: true,
      auth: {
        id: authUser.id,
        email: authUser.email,
      },
      profileExists: !!profile,
      onboarding_completed: profile?.onboarding_completed ?? null,
      onboardingComplete,
      diagnosis:
        profile === null
          ? 'No profiles row for this auth user id. Complete onboarding or POST /api/profile/update.'
          : onboardingComplete
            ? 'Onboarding flag is true in database.'
            : 'Onboarding flag is false or null in database — app may still treat user as incomplete.',
      profile,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
