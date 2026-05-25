// API route for completing onboarding - awards badges and points
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/onboarding/complete
 * Award welcome badge and points for completing onboarding
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  // Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in onboarding complete', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const body = await safeJsonParse<{ userId: string; awardBadge?: boolean; awardPoints?: boolean }>(req)
  if (!body) {
    return internalErrorResponse('Invalid request body', new Error('Failed to parse JSON'))
  }

  const adminClient = createAdminClient()

  try {
    // Award welcome badge if requested
    if (body.awardBadge) {
      try {
        const { data: welcomeBadge } = await adminClient
          .from('badges')
          .select('id')
          .eq('key', 'welcome')
          .maybeSingle()

        if (welcomeBadge && 'id' in welcomeBadge) {
          await adminClient
            .from('user_badges')
            .insert({
              user_id: userId,
              badge_id: welcomeBadge.id,
            } as any)
        }
      } catch (badgeError) {
        logger.error('Failed to award welcome badge', badgeError)
        // Don't fail the request if badge award fails
      }
    }

    // Award points for completing onboarding if requested
    if (body.awardPoints) {
      try {
        await adminClient.rpc('award_points', {
          user_id_param: userId,
          points_amount: 10,
          event_type: 'onboarding_completed',
          metadata_param: {},
        })
      } catch (pointsError) {
        logger.error('Failed to award onboarding points', pointsError)
        // Don't fail the request if points award fails
      }
    }

    return successResponse({
      message: 'Onboarding rewards processed successfully',
      userId,
    })
  } catch (error) {
    logger.error('Error completing onboarding', error)
    return internalErrorResponse('Failed to process onboarding rewards', error)
  }
})
