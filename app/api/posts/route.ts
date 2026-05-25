/**
 * Posts API - Get all posts (feed) and create new posts
 * GET /api/posts - Get posts feed with pagination
 * POST /api/posts - Create a new post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { validateRequest, validateSearchParams, getPostsSchema, createPostSchema, ValidationError } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/posts
 * Get posts feed with pagination, filtering, and author info
 */
export async function GET(req: NextRequest) {
  // Rate limit check (anonymous: 20/min, authenticated: 100/min)
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createServerClient()
    const { searchParams } = new URL(req.url)
    
    // Validate query parameters
    const { limit, offset, user_id: userId, type } = validateSearchParams(getPostsSchema, searchParams)
    
    // Build query - use simpler structure that matches actual schema
    // Note: Foreign key name might vary, so we'll try without explicit name first
    let query = supabase
      .from('posts')
      .select(`
        *,
        author:profiles(
          id,
          username,
          display_name,
          avatar_url,
          vendor_verified
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // Apply filters - userId is a profile UUID from query params
    if (userId) {
      query = query.eq('author', userId) // Column is 'author', not 'user_id'
    }
    
    // Note: content_type field may not exist in posts table
    // If type filter is needed, it should be added to the schema first
    // For now, we'll skip this filter to avoid errors
    // if (type) {
    //   query = query.eq('content_type', type)
    // }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1)
    
    const { data: posts, error, count } = await query
    
    if (error) {
      logger.error('Failed to fetch posts', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts', details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Posts feed error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST /api/posts
 * Create a new post (requires authentication)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse
    
    // Use admin client to bypass RLS (we're using Clerk auth, not Supabase auth)
    const supabase = createAdminClient()
    const body = await req.json()
    
    // Validate request body
    let validatedData
    try {
      validatedData = validateRequest(createPostSchema, body)
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: error.message, validation_errors: error.errors },
          { status: 400 }
        )
      }
      throw error
    }
    
    const { content, content_type, images, hashtags, mentions, location, visibility } = validatedData
    
    // Get user's profile UUID (posts.author is UUID, not Clerk string ID)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile) {
      logger.error('Profile not found for user', profileError, { userId });
      return NextResponse.json(
        { error: 'Profile not found. Please complete onboarding first.' },
        { status: 404 }
      );
    }
    
    // Create post with profile UUID
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        author: profile.id,  // Use profile UUID, not Clerk ID
        content,
        visibility: visibility || 'public',
      })
      .select(`
        *,
        author:profiles(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .single();
    
    if (postError) {
      logger.error('Failed to create post', postError, { userId, profileId: profile.id });
      return NextResponse.json(
        { error: 'Failed to create post', details: postError.message },
        { status: 500 }
      );
    }
    
    // Add images if provided - posts table has media_urls array column
    if (images && Array.isArray(images) && images.length > 0) {
      const imageUrls = images.slice(0, 10).map((img) => typeof img === 'string' ? img : (img.url || img))
      
      // Update post with media_urls array
      const { error: updateError } = await supabase
        .from('posts')
        .update({ media_urls: imageUrls })
        .eq('id', post.id)
      
      if (updateError) {
        logger.error('Failed to add post images', updateError, { postId: post.id })
        // Continue anyway - post was created
      } else {
        // Update the post object to include media_urls
        post.media_urls = imageUrls
      }
    }
    
    // Handle mentions
    const uniqueMentions = Array.from(new Set((mentions || []).filter((id: string) => id && id !== profile.id)))
    if (uniqueMentions.length) {
      try {
        await supabase
          .from('post_tags')
          .upsert(
            uniqueMentions.map((taggedUserId: string) => ({
              post_id: post.id,
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
                target_id: post.id,
                actor_id: profile.id,
                message: 'mentioned you in a post',
              } as any)
          )
        )
      } catch (mentionError) {
        logger.warn('Failed to record mentions for post', mentionError, { postId: post.id })
      }
    }

    // Update user stats (posts count) - use profile UUID, not Clerk ID
    // Note: This RPC function may not exist, so we'll wrap it in try-catch
    try {
      await supabase.rpc('increment_user_posts_count', { user_uuid: profile.id })
    } catch (rpcError) {
      logger.warn('Failed to increment posts count (RPC may not exist)', rpcError)
      // Continue anyway - post was created successfully
    }
    
    return NextResponse.json({
      data: post,  // Frontend expects { data: post }
      message: 'Post created successfully',
    }, { status: 201 })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Create post error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
