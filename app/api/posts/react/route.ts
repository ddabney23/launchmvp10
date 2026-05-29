/**
 * Post reactions endpoint
 * POST /api/posts/react - Add/update reaction to a post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { postId, reaction } = await req.json()

    if (!postId || !reaction) {
      return NextResponse.json({ error: 'Post ID and reaction required' }, { status: 400 })
    }

    const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']
    if (!validReactions.includes(reaction)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          details: 'You may need to complete onboarding first',
        },
        { status: 404 }
      )
    }

    const { error: reactionError } = await supabase
      .from('post_reactions')
      .upsert(
        {
          post_id: postId,
          user_id: profile.id,
          reaction_type: reaction,
        } as Record<string, string>,
        { onConflict: 'post_id,user_id' }
      )

    if (reactionError) {
      logger.error('Reaction upsert failed', reactionError)
      return NextResponse.json(
        { error: 'Failed to react', details: reactionError.message },
        { status: 500 }
      )
    }

    const { error: eventError } = await supabase.from('engagement_events').insert({
      user_id: profile.id,
      event_type: 'like',
      target_type: 'post',
      target_id: postId,
      metadata: { reaction_type: reaction },
    } as Record<string, unknown>)

    if (eventError) {
      logger.warn('Engagement event insert failed', eventError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('React endpoint error', error)
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 401 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { postId } = await req.json()

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          details: 'You may need to complete onboarding first',
        },
        { status: 404 }
      )
    }

    const { error: reactionError } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', profile.id)

    if (reactionError) {
      logger.error('Reaction delete failed', reactionError)
      return NextResponse.json(
        { error: 'Failed to unlike', details: reactionError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Unlike endpoint error', error)
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 401 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: 'Profile not found',
          details: 'You may need to complete onboarding first',
        },
        { status: 404 }
      )
    }

    const { data: reaction, error: reactionError } = await supabase
      .from('post_reactions')
      .select('reaction_type')
      .eq('post_id', postId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (reactionError && reactionError.code !== 'PGRST116') {
      logger.error('Reaction check failed', reactionError)
      return NextResponse.json(
        { error: 'Failed to check reaction', details: reactionError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      isLiked: !!reaction,
      reactionType: reaction?.reaction_type || null,
    })
  } catch (error) {
    logger.error('Check reaction endpoint error', error)
    return NextResponse.json(
      {
        error: 'Unauthorized',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 401 }
    )
  }
}
