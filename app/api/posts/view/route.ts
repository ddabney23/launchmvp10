/**
 * Post engagement endpoints - views, reactions, shares
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/posts/view
 * Record a post view
 */
export async function POST(req: NextRequest) {
  try {
    const { postId } = await req.json()
    
    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    // Get user ID (optional, can track anonymous views)
    let userId: string | null = null
    try {
      userId = await getAuthUserId()
    } catch {
      // Anonymous view
    }

    // Get user's profile UUID if authenticated
    let profileId: string | null = null
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()
      
      profileId = profile?.id || null
    }

    // Record view
    const { error } = await supabase
      .from('post_views')
      .insert({
        post_id: postId,
        user_id: profileId,
        viewer_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      })

    if (error && !error.message.includes('duplicate')) {
      console.error('View tracking error:', error)
    }

    // Also create engagement event for points
    if (profileId) {
      await supabase.from('engagement_events').insert({
        user_id: profileId,
        event_type: 'view',
        target_type: 'post',
        target_id: postId,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('View error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
