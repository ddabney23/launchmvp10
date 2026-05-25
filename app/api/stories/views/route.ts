/**
 * Story Views API - Record story views
 * POST /api/stories/views - Record a view for a story
 */

import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { safeEq, safeInsert, hasProperty } from '@/lib/supabase-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Story view creation schema
const StoryViewCreateSchema = z.object({
  story_id: z.string().uuid(),
})

/**
 * POST /api/stories/views
 * Record a view for a story
 * Automatically increments view count via database trigger
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in story views POST', authError)
      return unauthorizedResponse(
        'Authentication failed',
        authError instanceof Error ? authError.message : 'Unauthorized'
      )
    }

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse

    const adminClient = createAdminClient()

    // Get user's profile ID from Clerk ID
    const { data: profile, error: profileError } = await safeEq(
      adminClient
        .from('profiles')
        .select('id'),
      'id',
      userId
    ).maybeSingle()

    if (profileError || !profile || !hasProperty(profile, 'id')) {
      logger.error('Failed to fetch profile', profileError, { userId })
      return internalErrorResponse('Failed to fetch user profile', profileError)
    }

    const profileId = profile.id

    // Parse and validate request body
    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const validationResult = StoryViewCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const { story_id } = validationResult.data

    // Check if story exists and is still active
    const { data: story, error: storyError } = await safeEq(
      adminClient
        .from('stories')
        .select('id, user_id, expires_at'),
      'id',
      story_id
    ).maybeSingle()

    if (storyError || !story || !hasProperty(story, 'expires_at')) {
      logger.error('Story not found or error', storyError, { story_id })
      return errorResponse('Story not found or expired', 'NOT_FOUND', 'Story does not exist or has expired')
    }

    // Check if story is expired
    const expiresAt = new Date(story.expires_at)
    if (expiresAt < new Date()) {
      return errorResponse('Story has expired', 'EXPIRED', 'This story has expired')
    }

    // Check if user already viewed this story (upsert will handle duplicate)
    // Insert view (will fail silently if already exists due to UNIQUE constraint)
    const { data: view, error: viewError } = await safeInsert(
      adminClient.from('story_views'),
      {
        story_id,
        viewer_id: profileId,
      }
    )
      .select()
      .maybeSingle()

    // If error is due to duplicate, that's fine - user already viewed
    if (viewError) {
      // Check if it's a unique constraint violation (user already viewed)
      if (viewError.code === '23505' || viewError.message?.includes('duplicate')) {
        // User already viewed - return success
        return successResponse(
          { viewed: true, already_viewed: true },
          'View recorded (already viewed)'
        )
      }

      logger.error('Failed to record story view', viewError, { story_id, profileId })
      return internalErrorResponse('Failed to record view', viewError)
    }

    // Award points to story creator if view count milestones reached
    if (hasProperty(story, 'user_id')) {
      try {
        // Get current view count
        const { data: storyWithCount } = await safeEq(
          adminClient
            .from('stories')
            .select('view_count'),
          'id',
          story_id
        ).maybeSingle()

        if (storyWithCount && hasProperty(storyWithCount, 'view_count')) {
          const viewCount = storyWithCount.view_count

          // Award +10 points at 100 views milestone
          if (viewCount === 100) {
            await adminClient.rpc('award_points', {
              user_uuid: story.user_id,
              points_to_award: 10,
              reason: 'story_100_views',
              metadata: { story_id },
            })
          }

          // Check for "Viral Story" badge at 1000 views
          if (viewCount === 1000) {
            const { data: badge } = await adminClient
              .from('badges')
              .select('id')
              .eq('key', 'viral_story')
              .maybeSingle()

            if (badge && hasProperty(badge, 'id')) {
              await safeInsert(
                adminClient.from('user_badges'),
                {
                  user_id: story.user_id,
                  badge_id: badge.id,
                  earned_at: new Date().toISOString(),
                }
              ).catch(() => {
                // Badge might already exist - ignore
              })
            }
          }
        }
      } catch (pointsError) {
        logger.error('Failed to award points for story view milestone', pointsError)
        // Don't fail view recording if points fail
      }
    }

    return successResponse(
      { viewed: true, already_viewed: false },
      'View recorded successfully'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Story view recording error', error)
    return errorResponse(errorMessage, 'INTERNAL_ERROR')
  }
})

