/**
 * Stories API - Get active stories and create new stories
 * GET /api/stories - Get active stories for feed
 * POST /api/stories - Create a new story
 */

import { NextRequest, NextResponse } from 'next/server'
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

// Story creation schema
const StoryCreateSchema = z.object({
  media_url: z.string().url(),
  media_type: z.enum(['image', 'video']),
  caption: z.string().max(500).optional().nullable(),
  visibility: z.enum(['public', 'followers']).default('public'),
})

/**
 * GET /api/stories
 * Get active stories for the current user's feed
 * Returns stories from users they follow + public stories
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  // Rate limit check (authenticated: 100/min)
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in stories GET', authError)
      return unauthorizedResponse(
        'Authentication failed',
        authError instanceof Error ? authError.message : 'Unauthorized'
      )
    }

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

    // Get active stories using the database function
    // This function returns stories with view status and user info
    const { data: stories, error: storiesError } = await adminClient
      .rpc('get_active_stories', { user_uuid: profileId })

    if (storiesError) {
      logger.error('Failed to fetch stories', storiesError, { profileId })
      return internalErrorResponse('Failed to fetch stories', storiesError)
    }

    // Group stories by user for carousel display
    const storiesByUser = new Map<string, any[]>()
    
    if (stories && Array.isArray(stories)) {
      for (const story of stories) {
        const userId = story.user_id
        if (!storiesByUser.has(userId)) {
          storiesByUser.set(userId, [])
        }
        storiesByUser.get(userId)!.push(story)
      }
    }

    // Convert to array format for frontend
    const storiesArray = Array.from(storiesByUser.entries()).map(([userId, userStories]) => ({
      user_id: userId,
      username: userStories[0]?.username || 'Unknown',
      display_name: userStories[0]?.display_name || 'Unknown',
      avatar_url: userStories[0]?.avatar_url || null,
      stories: userStories.map(s => ({
        id: s.story_id,
        media_url: s.media_url,
        media_type: s.media_type,
        caption: s.caption,
        view_count: s.view_count,
        expires_at: s.expires_at,
        created_at: s.created_at,
        is_viewed: s.is_viewed,
        reply_count: s.reply_count || 0,
      })),
      has_unviewed: userStories.some(s => !s.is_viewed),
    }))

    // Sort: unviewed first, then by most recent
    storiesArray.sort((a, b) => {
      if (a.has_unviewed && !b.has_unviewed) return -1
      if (!a.has_unviewed && b.has_unviewed) return 1
      const aLatest = a.stories[0]?.created_at || ''
      const bLatest = b.stories[0]?.created_at || ''
      return bLatest.localeCompare(aLatest)
    })

    return successResponse({
      stories: storiesArray,
      total: storiesArray.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Stories feed error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
})

/**
 * POST /api/stories
 * Create a new story (requires authentication)
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  console.log('=== STORY API ROUTE START ===')
  console.log('Request URL:', req.url)
  console.log('Request method:', req.method)
  
  try {
    // CLERK MIGRATION: Authenticate user with Clerk
    let userId: string
    try {
      console.log('Attempting to get Clerk user ID for story...')
      userId = await getAuthUserId()
      console.log('Story API - Authenticated user', { userId: userId.substring(0, 10) + '...' })
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed'
      console.error('Story API - Authentication failed', {
        error: errorMessage,
        errorType: authError?.constructor?.name,
        stack: authError instanceof Error ? authError.stack : undefined
      })
      logger.error('Authentication error in stories POST', authError)
      return unauthorizedResponse(
        'Authentication failed',
        errorMessage
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

    const validationResult = StoryCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error.errors)
    }

    const storyData = validationResult.data

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    // Create story
    const { data: story, error: storyError } = await safeInsert(
      adminClient.from('stories'),
      {
        user_id: profileId,
        media_url: storyData.media_url,
        media_type: storyData.media_type,
        caption: storyData.caption || null,
        visibility: storyData.visibility,
        expires_at: expiresAt.toISOString(),
      }
    )
      .select()
      .single()

    if (storyError || !story) {
      logger.error('Story creation error', storyError, { profileId, storyData })
      return internalErrorResponse(
        storyError?.message || 'Failed to create story. Please try again.',
        storyError
      )
    }

    // Award points for story creation (+3 points)
    try {
      await adminClient.rpc('award_points', {
        user_uuid: profileId,
        points_to_award: 3,
        reason: 'story_created',
        metadata: { story_id: story.id },
      })
    } catch (pointsError) {
      logger.error('Failed to award points for story creation', pointsError, {
        profileId,
        storyId: story.id,
      })
      // Don't fail story creation if points fail
    }

    // Check for "Story Starter" badge (first story)
    try {
      const { data: existingStories } = await safeEq(
        adminClient
          .from('stories')
          .select('id'),
        'user_id',
        profileId
      )

      if (existingStories && Array.isArray(existingStories) && existingStories.length === 1) {
        // This is the first story - award badge
        const { data: badge } = await adminClient
          .from('badges')
          .select('id')
          .eq('key', 'story_starter')
          .maybeSingle()

        if (badge && hasProperty(badge, 'id')) {
          await safeInsert(
            adminClient.from('user_badges'),
            {
              user_id: profileId,
              badge_id: badge.id,
              earned_at: new Date().toISOString(),
            }
          )
        }
      }
    } catch (badgeError) {
      logger.error('Failed to check/award story starter badge', badgeError)
      // Don't fail story creation if badge check fails
    }

    return successResponse(
      { story },
      'Story created successfully! It will expire in 24 hours.'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Story creation error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
})

