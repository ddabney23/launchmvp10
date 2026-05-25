/**
 * Update/Delete individual post
 * PATCH /api/posts/[postId] - Update post content/visibility
 * DELETE /api/posts/[postId] - Delete post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/posts/[postId]
 * Update post content and/or visibility
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
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

    const supabase = createAdminClient()
    const body = await req.json()
    const { content, visibility } = body

    const { postId } = await params

    // Get user's profile UUID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Verify post ownership
    const { data: post } = await supabase
      .from('posts')
      .select('author')
      .eq('id', postId)
      .single()

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.author !== profile.id) {
      return NextResponse.json(
        { error: 'You can only edit your own posts' },
        { status: 403 }
      )
    }

    // Update post
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    
    if (content !== undefined) updates.content = content
    if (visibility !== undefined) updates.visibility = visibility

    const { data: updatedPost, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select(`
        *,
        author:profiles!posts_author_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .single()

    if (error) {
      logger.error('Failed to update post', error)
      return NextResponse.json(
        { error: 'Failed to update post' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updatedPost })
  } catch (error) {
    logger.error('Update post error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/posts/[postId]
 * Delete a post
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
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    const { postId } = await params

    // Get user's profile UUID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Verify post ownership
    const { data: post } = await supabase
      .from('posts')
      .select('author')
      .eq('id', postId)
      .single()

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    if (post.author !== profile.id) {
      return NextResponse.json(
        { error: 'You can only delete your own posts' },
        { status: 403 }
      )
    }

    // Delete post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      logger.error('Failed to delete post', error)
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Post deleted successfully' })
  } catch (error) {
    logger.error('Delete post error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
