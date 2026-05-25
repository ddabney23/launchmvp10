/**
 * Post reactions endpoint
 * POST /api/posts/react - Add/update reaction to a post
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    console.log('=== REACT ENDPOINT START ===')
    const userId = await getAuthUserId()
    console.log('Clerk User ID:', userId)
    
    const { postId, reaction } = await req.json()
    console.log('Request body:', { postId, reaction })

    if (!postId || !reaction) {
      console.log('Missing postId or reaction')
      return NextResponse.json({ error: 'Post ID and reaction required' }, { status: 400 })
    }

    const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry']
    if (!validReactions.includes(reaction)) {
      console.log('Invalid reaction:', reaction)
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get profile ID
    console.log('Looking up profile for id:', userId)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    console.log('Profile lookup result:', { profile, profileError })

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return NextResponse.json({ 
        error: 'Profile not found',
        details: 'You may need to complete onboarding first',
        userId 
      }, { status: 404 })
    }

    console.log('Profile ID:', profile.id)

    // Upsert reaction (replaces old reaction if exists)
    console.log('Upserting reaction...')
    const { error: reactionError } = await supabase
      .from('post_reactions')
      .upsert({
        post_id: postId,
        user_id: profile.id,
        reaction_type: reaction,
      } as any, {
        onConflict: 'post_id,user_id'
      })

    console.log('Reaction upsert result:', { reactionError })

    if (reactionError) {
      console.error('Reaction error:', reactionError)
      return NextResponse.json({ error: 'Failed to react', details: reactionError.message }, { status: 500 })
    }

    // Record engagement event for points
    console.log('Recording engagement event...')
    const { error: eventError } = await supabase.from('engagement_events').insert({
      user_id: profile.id,
      event_type: 'like',
      target_type: 'post',
      target_id: postId,
      metadata: { reaction_type: reaction }
    } as any)

    if (eventError) {
      console.error('Engagement event error:', eventError)
    }

    console.log('=== REACT ENDPOINT SUCCESS ===')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('React endpoint error:', error)
    return NextResponse.json({ error: 'Unauthorized', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 401 })
  }
}

/**
 * DELETE /api/posts/react - Remove reaction from a post
 */
export async function DELETE(req: NextRequest) {
  try {
    console.log('=== UNLIKE ENDPOINT START ===')
    const userId = await getAuthUserId()
    console.log('Clerk User ID:', userId)
    
    const { postId } = await req.json()
    console.log('Request body:', { postId })

    if (!postId) {
      console.log('Missing postId')
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get profile ID
    console.log('Looking up profile for id:', userId)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    console.log('Profile lookup result:', { profile, profileError })

    if (profileError || !profile) {
      console.error('Profile lookup error:', profileError)
      return NextResponse.json({ 
        error: 'Profile not found',
        details: 'You may need to complete onboarding first',
        userId 
      }, { status: 404 })
    }

    console.log('Profile ID:', profile.id)

    // Delete reaction
    console.log('Deleting reaction...')
    const { error: reactionError } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', profile.id)

    console.log('Reaction delete result:', { reactionError })

    if (reactionError) {
      console.error('Reaction delete error:', reactionError)
      return NextResponse.json({ error: 'Failed to unlike', details: reactionError.message }, { status: 500 })
    }

    console.log('=== UNLIKE ENDPOINT SUCCESS ===')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unlike endpoint error:', error)
    return NextResponse.json({ error: 'Unauthorized', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 401 })
  }
}

/**
 * GET /api/posts/react - Check if user has reacted to a post
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId()
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ 
        error: 'Profile not found',
        details: 'You may need to complete onboarding first'
      }, { status: 404 })
    }

    // Check if reaction exists
    const { data: reaction, error: reactionError } = await supabase
      .from('post_reactions')
      .select('reaction_type')
      .eq('post_id', postId)
      .eq('user_id', profile.id)
      .maybeSingle()

    if (reactionError && reactionError.code !== 'PGRST116') {
      console.error('Reaction check error:', reactionError)
      return NextResponse.json({ error: 'Failed to check reaction', details: reactionError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      isLiked: !!reaction,
      reactionType: reaction?.reaction_type || null
    })
  } catch (error) {
    console.error('Check reaction endpoint error:', error)
    return NextResponse.json({ error: 'Unauthorized', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 401 })
  }
}