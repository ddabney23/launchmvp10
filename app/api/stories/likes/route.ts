/**
 * Story Likes API - Like/unlike stories
 * POST /api/stories/likes - Toggle like on a story
 * GET /api/stories/likes?story_id=xxx - Get like status and count
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
import { safeEq, safeInsert, safeUpdate, hasProperty } from '@/lib/supabase-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Story like schema
const StoryLikeSchema = z.object({
  story_id: z.string().uuid(),
})

/**
 * POST /api/stories/likes
 * Toggle like on a story
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in story likes POST', authError)
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

    const validationResult = StoryLikeSchema.safeParse(body)
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

    // Check if user already liked this story
    const { data: existingLike, error: likeCheckError } = await safeEq(
      adminClient
        .from('story_likes')
        .select('id'),
      'story_id',
      story_id
    )
      .eq('user_id', profileId)
      .maybeSingle()

    if (likeCheckError && likeCheckError.code !== 'PGRST116') {
      logger.error('Error checking existing like', likeCheckError, { story_id, profileId })
      return internalErrorResponse('Failed to check like status', likeCheckError)
    }

    if (existingLike) {
      // Unlike: Delete the like
      const { error: deleteError } = await adminClient
        .from('story_likes')
        .delete()
        .eq('story_id', story_id)
        .eq('user_id', profileId)

      if (deleteError) {
        logger.error('Failed to unlike story', deleteError, { story_id, profileId })
        return internalErrorResponse('Failed to unlike story', deleteError)
      }

      return successResponse(
        { liked: false, message: 'Story unliked' },
        'Story unliked successfully'
      )
    } else {
      // Like: Create the like
      const { data: like, error: likeError } = await safeInsert(
        adminClient.from('story_likes'),
        {
          story_id,
          user_id: profileId,
        }
      )
        .select()
        .single()

      if (likeError || !like) {
        logger.error('Failed to like story', likeError, { story_id, profileId })
        return internalErrorResponse(
          likeError?.message || 'Failed to like story. Please try again.',
          likeError
        )
      }

      // Award points to story creator (+1 point per like)
      if (hasProperty(story, 'user_id') && story.user_id !== profileId) {
        try {
          await adminClient.rpc('award_points', {
            user_uuid: story.user_id,
            points_to_award: 1,
            reason: 'story_like',
            metadata: { story_id, like_id: like.id },
          })
        } catch (pointsError) {
          logger.error('Failed to award points for story like', pointsError, {
            storyId: story_id,
            storyCreatorId: story.user_id,
          })
          // Don't fail like creation if points fail
        }
      }

      return successResponse(
        { liked: true, like, message: 'Story liked' },
        'Story liked successfully!'
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Story like toggle error', error)
    return errorResponse(errorMessage, 'INTERNAL_ERROR')
  }
})

/**
 * GET /api/stories/likes?story_id=xxx
 * Get like status and count for a story
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      // Allow unauthenticated users to see like counts
      userId = ''
    }

    const adminClient = createAdminClient()
    const { searchParams } = new URL(req.url)
    const story_id = searchParams.get('story_id')

    if (!story_id) {
      return errorResponse('story_id is required', 'MISSING_PARAM')
    }

    // Get like count
    const { count: likeCount, error: countError } = await adminClient
      .from('story_likes')
      .select('*', { count: 'exact', head: true })
      .eq('story_id', story_id)

    if (countError) {
      logger.error('Failed to get like count', countError, { story_id })
      return internalErrorResponse('Failed to get like count', countError)
    }

    // Get user's like status if authenticated
    let isLiked = false
    if (userId) {
      const { data: profile } = await safeEq(
        adminClient
          .from('profiles')
          .select('id'),
      'id',
        userId
      ).maybeSingle()

      if (profile && hasProperty(profile, 'id')) {
        const { data: userLike } = await safeEq(
          adminClient
            .from('story_likes')
            .select('id'),
          'story_id',
          story_id
        )
          .eq('user_id', profile.id)
          .maybeSingle()

        isLiked = !!userLike
      }
    }

    return successResponse({
      is_liked: isLiked,
      like_count: likeCount || 0,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Story like status error', error)
    return errorResponse(errorMessage, 'INTERNAL_ERROR')
  }
})

