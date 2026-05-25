/**
 * Story Replies API - Send replies to stories
 * POST /api/stories/replies - Send a reply to a story
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

// Story reply creation schema
const StoryReplyCreateSchema = z.object({
  story_id: z.string().uuid(),
  message: z.string().min(1).max(500),
})

/**
 * POST /api/stories/replies
 * Send a reply to a story
 * Awards points to story creator (+2 points per reply)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in story replies POST', authError)
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

    const validationResult = StoryReplyCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const { story_id, message } = validationResult.data

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

    // Prevent users from replying to their own stories
    if (hasProperty(story, 'user_id') && story.user_id === profileId) {
      return errorResponse('Cannot reply to your own story', 'INVALID_OPERATION', 'You cannot reply to your own story')
    }

    // Create reply
    const { data: reply, error: replyError } = await safeInsert(
      adminClient.from('story_replies'),
      {
        story_id,
        sender_id: profileId,
        message: message.trim(),
      }
    )
      .select()
      .single()

    if (replyError || !reply) {
      logger.error('Story reply creation error', replyError, { story_id, profileId })
      return internalErrorResponse(
        replyError?.message || 'Failed to send reply. Please try again.',
        replyError
      )
    }

    // Award points to story creator (+2 points per reply)
    if (hasProperty(story, 'user_id')) {
      try {
        await adminClient.rpc('award_points', {
          user_uuid: story.user_id,
          points_to_award: 2,
          reason: 'story_reply',
          metadata: { story_id, reply_id: reply.id },
        })
      } catch (pointsError) {
        logger.error('Failed to award points for story reply', pointsError, {
          storyId: story_id,
          storyCreatorId: story.user_id,
        })
        // Don't fail reply creation if points fail
      }
    }

    return successResponse(
      { reply },
      'Reply sent successfully!'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Story reply creation error', error)
    return errorResponse(errorMessage, 'INTERNAL_ERROR')
  }
})

