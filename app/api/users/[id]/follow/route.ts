/**
 * Follow/Unfollow API
 * POST /api/users/[id]/follow - Follow a user
 * DELETE /api/users/[id]/follow - Unfollow a user
 * GET /api/users/[id]/followers - Get user's followers
 * GET /api/users/[id]/following - Get users being followed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/[id]/follow
 * Get followers or following list
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit check (anonymous: 20/min, authenticated: 100/min)
  const rateLimitResponse = await rateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createServerClient()
    const { id: targetUserId } = await params
    const { searchParams } = new URL(req.url)
    
    // Check if this is a follow status check
    const checkFollow = searchParams.get('check') === 'true'
    if (checkFollow) {
      // Get current user's profile UUID if authenticated
      try {
        const userId = await getAuthUserId()
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single()
        
        if (currentProfile) {
          // Check if current user follows target user
          const { data: follow } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', currentProfile.id)
            .eq('following_id', targetUserId)
            .single()
          
          return NextResponse.json({
            isFollowing: !!follow && !follow.error,
          })
        }
      } catch {
        // Not authenticated, return false
        return NextResponse.json({ isFollowing: false })
      }
    }
    
    const type = searchParams.get('type') || 'followers' // followers or following
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let query
    
    if (type === 'followers') {
      // Get users who follow this user
      query = supabase
        .from('follows')
        .select(`
          follower:profiles!follows_follower_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            bio,
            is_verified,
            vendor_verified
          ),
          created_at
        `, { count: 'exact' })
        .eq('following_id', targetUserId)
    } else {
      // Get users this user follows
      query = supabase
        .from('follows')
        .select(`
          following:profiles!follows_following_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            bio,
            is_verified,
            vendor_verified
          ),
          created_at
        `, { count: 'exact' })
        .eq('follower_id', targetUserId)
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      logger.error(`Failed to fetch ${type}`, error)
      return NextResponse.json(
        { error: `Failed to fetch ${type}`, details: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      users: data || [],
      total: count || 0,
      limit,
      offset,
      type,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Get follow list error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users/[id]/follow
 * Follow a user
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse
    
    const supabase = await createServerClient()
    const { id: targetUserId } = await params
    
    // Get current user's profile UUID
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (currentProfileError || !currentProfile) {
      logger.error('Profile not found for current user', currentProfileError, { userId })
      return NextResponse.json(
        { error: 'Profile not found. Please complete onboarding first.' },
        { status: 404 }
      )
    }
    
    // Verify target user exists (targetUserId is already a profile UUID from the route)
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', targetUserId)
      .single()
    
    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Can't follow yourself
    if (currentProfile.id === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot follow yourself' },
        { status: 400 }
      )
    }
    
    // Check if already following
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentProfile.id)
      .eq('following_id', targetUserId)
      .single()
    
    if (existingFollow) {
      return NextResponse.json(
        { error: 'You are already following this user' },
        { status: 400 }
      )
    }
    
    // Create follow relationship (using profile UUIDs)
    const { error: followError } = await supabase
      .from('follows')
      .insert({
        follower_id: currentProfile.id,
        following_id: targetUserId,
      })
    
    if (followError) {
      logger.error('Failed to follow user', followError, { userId, profileId: currentProfile.id, targetUserId })
      return NextResponse.json(
        { error: 'Failed to follow user', details: followError.message },
        { status: 500 }
      )
    }
    
    // Update follower/following counts (using profile UUIDs)
    await Promise.all([
      supabase.rpc('increment_user_following_count', { user_uuid: currentProfile.id }),
      supabase.rpc('increment_user_followers_count', { user_uuid: targetUserId }),
    ])
    
    // Create notification for target user
    await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'follow',
        title: 'New follower',
        message: `Someone started following you`,
        action_url: `/profile/${currentProfile.id}`,
        sender_id: currentProfile.id,
        is_read: false,
      })
    
    return NextResponse.json({
      message: 'User followed successfully',
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Follow user error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]/follow
 * Unfollow a user
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse
    
    const supabase = await createServerClient()
    const { id: targetUserId } = await params
    
    // Get current user's profile UUID
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (currentProfileError || !currentProfile) {
      logger.error('Profile not found for current user', currentProfileError, { userId })
      return NextResponse.json(
        { error: 'Profile not found. Please complete onboarding first.' },
        { status: 404 }
      )
    }
    
    // Delete follow relationship (using profile UUIDs)
    const { error: unfollowError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', currentProfile.id)
      .eq('following_id', targetUserId)
    
    if (unfollowError) {
      logger.error('Failed to unfollow user', unfollowError, { userId, profileId: currentProfile.id, targetUserId })
      return NextResponse.json(
        { error: 'Failed to unfollow user', details: unfollowError.message },
        { status: 500 }
      )
    }
    
    // Update follower/following counts (using profile UUIDs)
    await Promise.all([
      supabase.rpc('decrement_user_following_count', { user_uuid: currentProfile.id }),
      supabase.rpc('decrement_user_followers_count', { user_uuid: targetUserId }),
    ])
    
    return NextResponse.json({
      message: 'User unfollowed successfully',
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Unfollow user error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
