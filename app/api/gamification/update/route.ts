// CLERK MIGRATION: Updated to use Clerk authentication
import { NextRequest } from 'next/server'
import { createClientFromRequest, createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { GamificationUpdateSchema } from '@/lib/validations/schemas'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Points awarded for each action
const POINTS_MAP: Record<string, number> = {
  purchase: 10,
  post_created: 5,
  comment_created: 2,
  like_given: 1,
  follow_user: 3,
  listing_created: 15,
  booking_created: 8,
  review_created: 5,
}

/**
 * POST /api/gamification/update
 * Update user points and credits based on actions
 * This is typically called after successful operations (purchase, post creation, etc.)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate user with Clerk
  let currentUserId: string
  try {
    currentUserId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in gamification update', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated write: 30/min)
  const rateLimitResponse = await rateLimit(req, { userId: currentUserId })
  if (rateLimitResponse) return rateLimitResponse

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const { userId, action, metadata } = validateRequest(GamificationUpdateSchema, body)

  // Use admin client for profile checks and updates (bypasses RLS)
  const adminClient = createAdminClient()

  // Verify user can only update their own points (unless admin)
  const { data: profile, error: profileCheckError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', currentUserId)
    .maybeSingle()

  if (profileCheckError) {
    logger.error('Failed to check admin status', profileCheckError, { userId: currentUserId })
    return internalErrorResponse('Failed to verify permissions', profileCheckError)
  }

  const isAdmin = profile?.is_admin === true

  if (userId !== currentUserId && !isAdmin) {
    return forbiddenResponse('You can only update your own gamification data')
  }

  // Get points for this action
  const pointsToAdd = POINTS_MAP[action] || 0

  if (pointsToAdd === 0) {
    return errorResponse('Invalid action or action does not award points', 'INVALID_ACTION')
  }

  const { data: currentProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('points, credits, id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    logger.error('Failed to fetch profile for gamification', profileError, { userId })
    return internalErrorResponse('Failed to fetch profile', profileError)
  }

  if (!currentProfile) {
    return notFoundResponse('User profile not found')
  }

    const newPoints = (currentProfile.points || 0) + pointsToAdd

  // Update points in profile - use the profile's UUID id
  const profileId = currentProfile.id
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ points: newPoints })
    .eq('id', profileId)

  if (updateError) {
    logger.error('Failed to update points', updateError, { userId, pointsToAdd })
    return internalErrorResponse('Failed to update points', updateError)
  }

    // Record points history - use profile UUID id
    const { error: historyError } = await adminClient
      .from('user_points')
      .insert({
        user_id: profileId,
        points: pointsToAdd,
        reason: action,
        metadata: metadata || {},
        awarded_at: new Date().toISOString(),
      })

    if (historyError) {
      logger.error('Failed to record points history', historyError, { userId, pointsToAdd, action })
      // Don't fail the request if history recording fails
    }

    // Handle purchase-specific logic (credits)
    if (action === 'purchase' && metadata?.amount) {
      const creditsToAdd = Math.floor(Number(metadata.amount) * 0.1) // 10% of purchase as credits
      const newCredits = (currentProfile.credits || 0) + creditsToAdd

      await adminClient
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', profileId)

      // Record credits history in user_points table
      await adminClient
        .from('user_points')
        .insert({
          user_id: profileId,
          points: 0, // No points, just tracking credits
          reason: 'purchase_reward_credits',
          metadata: { ...metadata, credits: creditsToAdd },
          awarded_at: new Date().toISOString(),
        })
    }

  // Check for badge unlocks (simplified - you may want to expand this)
  await checkBadgeUnlocks(adminClient, userId, newPoints)

  return successResponse(
    {
      pointsAdded: pointsToAdd,
      newTotalPoints: newPoints,
    },
    `Points updated successfully for action: ${action}`
  )
})

/**
 * Check if user should unlock any badges based on points
 */
async function checkBadgeUnlocks(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  totalPoints: number
) {
  // Define badge thresholds (you may want to move this to a config or database)
  const badgeThresholds = [
    { points: 100, badgeName: 'Bronze Member' },
    { points: 500, badgeName: 'Silver Member' },
    { points: 1000, badgeName: 'Gold Member' },
    { points: 5000, badgeName: 'Platinum Member' },
  ]

  for (const threshold of badgeThresholds) {
    if (totalPoints >= threshold.points) {
      // Check if user already has this badge
      const { data: existingBadge } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_name', threshold.badgeName)
        .maybeSingle()

      if (!existingBadge) {
        // Find badge ID
        const { data: badge } = await supabase
          .from('badges')
          .select('id')
          .eq('name', threshold.badgeName)
          .maybeSingle()

        if (badge) {
          // Award badge
          await supabase
            .from('user_badges')
            .insert({
              user_id: userId,
              badge_id: badge.id,
              earned_at: new Date().toISOString(),
            })

          // Create notification
          await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'badge_earned',
              data: { 
                badgeId: badge.id, 
                badgeName: threshold.badgeName,
                title: 'Badge Unlocked!',
                message: `Congratulations! You've earned the ${threshold.badgeName} badge!`,
              },
            })
        }
      }
    }
  }
}

