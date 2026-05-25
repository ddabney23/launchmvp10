/**
 * Notifications API
 * GET /api/notifications - Get user's notifications
 * PATCH /api/notifications/[id]/read - Mark notification as read
 * PATCH /api/notifications/read-all - Mark all notifications as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { safeEq } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/notifications
 * Get user's notifications
 */
export async function GET(req: NextRequest) {
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

    // Rate limit check (authenticated read: 100/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse
    
    const supabase = await createServerClient()
    const { searchParams } = new URL(req.url)
    
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const cursor = searchParams.get('cursor') // ISO timestamp for cursor-based pagination
    const unreadOnly = searchParams.get('unread') === 'true'
    
    // Optimized: Use cursor pagination instead of offset for better performance
    let query = supabase
      .from('notifications')
      .select(`
        id,
        type,
        data,
        is_read,
        created_at,
        sender_id,
        sender:profiles!notifications_sender_id_fkey(
          id,
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `, { count: 'exact' })
    
    query = safeEq(query, 'user_id', userId)
    query = query.order('created_at', { ascending: false })
    query = query.limit(limit)
    
    // Cursor-based pagination (more efficient than offset for large datasets)
    if (cursor) {
      query = query.lt('created_at', cursor)
    }
    
    if (unreadOnly) {
      query = safeEq(query, 'is_read', false)
    }
    
    const { data: notifications, error, count } = await query
    
    if (error) {
      logger.error('Failed to fetch notifications', error, { userId })
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: error.message },
        { status: 500 }
      )
    }
    
    // Get unread count
    const countQuery = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
    const withUserFilter = safeEq(countQuery, 'user_id', userId)
    const { count: unreadCount } = await safeEq(withUserFilter, 'is_read', false)
    
    return NextResponse.json({
      notifications: notifications || [],
      total: count || 0,
      unread_count: unreadCount || 0,
      limit,
      nextCursor: notifications && notifications.length > 0 
        ? notifications[notifications.length - 1].created_at 
        : null,
      hasMore: notifications ? notifications.length === limit : false,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Get notifications error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
