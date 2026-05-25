/**
 * Comments API endpoint
 * POST /api/posts/[postId]/comments - Create a comment on a post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { sanitizeString } from '@/lib/sanitize'
import { CommentCreateSchema } from '@/lib/validations/schemas'
import { rateLimit } from '@/lib/rate-limit'

// Ensure the validation schema exists
if (!CommentCreateSchema) {
  throw new Error('CommentCreateSchema is not defined')
}

export const dynamic = 'force-dynamic'

/**
 * POST /api/posts/[postId]/comments
 * Create a new comment on a post (requires authentication)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  console.log('=== COMMENT API ROUTE START ===')
  console.log('Request URL:', req.url)
  console.log('Request method:', req.method)
  
  try {
    // Authenticate user
    let userId: string
    try {
      console.log('Attempting to get Clerk user ID...')
      userId = await getAuthUserId()
      console.log('Comment API - Authenticated user', { userId: userId.substring(0, 10) + '...' })
      logger.info('Comment API - Authenticated user', { userId: userId.substring(0, 10) + '...' })
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication failed'
      console.error('Comment API - Authentication failed', { 
        error: errorMessage,
        errorType: authError?.constructor?.name,
        stack: authError instanceof Error ? authError.stack : undefined
      })
      logger.error('Comment API - Authentication failed', { 
        error: errorMessage,
        errorType: authError?.constructor?.name,
        stack: authError instanceof Error ? authError.stack : undefined
      })
      
      // Return proper JSON error response
      const errorResponse = {
        success: false,
        error: 'Unauthorized. Please sign in.',
        code: 'UNAUTHORIZED',
        details: errorMessage
      }
      console.log('Returning error response:', errorResponse)
      return NextResponse.json(
        errorResponse,
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse

    console.log('Getting postId from params...')
    const { postId } = await params // Next.js 15: params is now a Promise
    console.log('PostId:', postId)
    
    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      )
    }

    console.log('Parsing request body...')
    let body: any
    try {
      body = await req.json()
      console.log('Request body:', body)
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Validate request body (content and optional parent_id)
    console.log('Validating request body...')
    const validationResult = CommentCreateSchema.safeParse({
      post_id: postId,
      ...body,
    })

    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors)
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { content, parent_id, mentions } = validationResult.data
    console.log('Validation passed. Content:', content?.substring(0, 50) + '...')

    // Get user's profile UUID
    console.log('Looking up profile for id:', userId.substring(0, 10) + '...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile not found:', profileError)
      logger.error('Profile not found for user', profileError, { userId })
      return NextResponse.json(
        { 
          success: false,
          error: 'Profile not found. Please complete onboarding first.',
          code: 'PROFILE_NOT_FOUND'
        },
        { status: 404 }
      )
    }
    console.log('Profile found:', profile.id.substring(0, 10) + '...')

    // Sanitize comment content
    console.log('Sanitizing content...')
    let sanitizedContent: string
    try {
      sanitizedContent = sanitizeString(content)
      console.log('Content sanitized:', sanitizedContent.substring(0, 50) + '...')
    } catch (sanitizeError) {
      console.error('Sanitization error:', sanitizeError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to sanitize content',
          code: 'SANITIZATION_ERROR'
        },
        { status: 400 }
      )
    }

    // Create comment
    console.log('Creating comment in database...')
    // Build insert data - only include parent_id if provided (column may not exist yet)
    const insertData: Record<string, any> = {
      post_id: postId,
      author: profile.id, // Use profile UUID
      content: sanitizedContent,
    }
    
    // Only add parent_id if it's provided (for nested comments)
    // Note: parent_id column needs migration 041_add_comments_parent_id.sql
    if (parent_id) {
      insertData.parent_id = parent_id
    }
    
    console.log('Insert data (sanitized):', {
      post_id: insertData.post_id,
      author: insertData.author.substring(0, 10) + '...',
      content: insertData.content.substring(0, 50) + '...',
      parent_id: insertData.parent_id || null,
    })
    
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert(insertData)
      .select()
      .single()

    if (commentError) {
      console.error('Failed to create comment:', commentError)
      logger.error('Failed to create comment', commentError, {
        userId,
        profileId: profile.id,
        postId,
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create comment',
          code: 'COMMENT_CREATE_ERROR',
          details: commentError.message,
        },
        { status: 500 }
      )
    }
    console.log('Comment created successfully:', comment.id)

    // Update post comment count (if RPC exists)
    try {
      await supabase.rpc('increment_post_comment_count', {
        post_uuid: postId,
      })
    } catch (rpcError) {
      // RPC might not exist, log but don't fail
      logger.warn('Failed to increment comment count', rpcError)
    }

    // Create notification for post author (unless commenting on own post)
    try {
      const { data: post } = await supabase
        .from('posts')
        .select('author')
        .eq('id', postId)
        .single()

      if (post && post.author !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: post.author,
          type: 'comment',
          target_type: 'post',
          target_id: postId,
          actor_id: profile.id,
          message: 'commented on your post',
        } as any)
      }
    } catch (notifError) {
      // Notification creation is non-critical, log but don't fail
      logger.warn('Failed to create notification', notifError)
    }

    // Award points for commenting (+2 points)
    try {
      await supabase.rpc('award_points', {
        user_uuid: profile.id,
        points: 2,
        reason: 'comment_created',
        metadata: { post_id: postId, comment_id: comment.id },
      } as any)
    } catch (pointsError) {
      // Points are non-critical, log but don't fail
      logger.warn('Failed to award points for comment', pointsError)
    }

    // Handle mentions (notify tagged users)
    const uniqueMentions = Array.from(new Set((mentions || []).filter((id: string) => id && id !== profile.id)))
    if (uniqueMentions.length) {
      try {
        await supabase
          .from('post_tags')
          .upsert(
            uniqueMentions.map((taggedUserId: string) => ({
              post_id: postId,
              tagged_user_id: taggedUserId,
            })),
            { onConflict: 'post_id,tagged_user_id' }
          )

        await Promise.all(
          uniqueMentions.map((taggedUserId: string) =>
            supabase
              .from('notifications')
              .insert({
                user_id: taggedUserId,
                type: 'mention',
                target_type: 'post',
                target_id: postId,
                actor_id: profile.id,
                message: 'mentioned you in a comment',
              } as any)
          )
        )
      } catch (mentionError) {
        logger.warn('Failed to process comment mentions', mentionError)
      }
    }

    console.log('Returning success response')
    return NextResponse.json(
      {
        success: true,
        data: comment,
        message: 'Comment created successfully',
      },
      { 
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorType = error?.constructor?.name || 'UnknownError'
    
    console.error('=== COMMENT API ERROR ===')
    console.error('Error message:', errorMessage)
    console.error('Error type:', errorType)
    console.error('Error stack:', errorStack)
    
    logger.error('Error creating comment', {
      error: errorMessage,
      errorType,
      stack: errorStack
    })
    
    // Ensure we always return valid JSON
    try {
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          details: errorMessage,
          message: errorMessage, // Also include as message for backward compatibility
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    } catch (jsonError) {
      // If even JSON response fails, return plain text
      console.error('Failed to create JSON error response:', jsonError)
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          details: errorMessage,
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }
  }
}

/**
 * DELETE /api/posts/[postId]/comments
 * Delete a comment (requires authentication and ownership)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    // Authenticate user
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized. Please sign in.',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    // Rate limit check
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse

    const { postId } = await params
    const { searchParams } = new URL(req.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Comment ID is required',
          code: 'MISSING_COMMENT_ID'
        },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get user's profile UUID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      logger.error('Profile not found for comment deletion', profileError, { userId })
      return NextResponse.json(
        { 
          success: false,
          error: 'Profile not found. Please complete onboarding first.',
          code: 'PROFILE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Verify comment ownership
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('author, post_id')
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      logger.error('Comment not found', commentError, { commentId })
      return NextResponse.json(
        { 
          success: false,
          error: 'Comment not found',
          code: 'COMMENT_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Verify comment belongs to the post
    if (comment.post_id !== postId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Comment does not belong to this post',
          code: 'INVALID_COMMENT'
        },
        { status: 400 }
      )
    }

    // Verify ownership (user can only delete their own comments)
    if (comment.author !== profile.id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'You can only delete your own comments',
          code: 'FORBIDDEN'
        },
        { status: 403 }
      )
    }

    // Delete comment
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (deleteError) {
      logger.error('Failed to delete comment', deleteError, { commentId, userId })
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to delete comment',
          code: 'DELETE_ERROR',
          details: deleteError.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Delete comment error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

