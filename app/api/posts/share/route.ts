/**
 * Post share tracking endpoint
 * POST /api/posts/share - Increment share count
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Increment share count using RPC function
    const { error } = await supabase.rpc('increment_share_count', { post_id: postId })

    if (error) {
      console.error('Share count error:', error)
    }

    // Record engagement event for points (if authenticated)
    try {
      const userId = await getAuthUserId()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (profile) {
        await supabase.from('engagement_events').insert({
          user_id: profile.id,
          event_type: 'share',
          target_type: 'post',
          target_id: postId,
        })
      }
    } catch {
      // Anonymous share, no points
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Share error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
