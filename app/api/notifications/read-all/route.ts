/**
 * Mark All Notifications as Read
 * PATCH /api/notifications/read-all - Mark all notifications as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { safeEq, safeUpdate } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/notifications/read-all
 * Mark all user's notifications as read
 */
export async function PATCH(req: NextRequest) {
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
    
    const supabase = await createServerClient()
    
    // Update all unread notifications
    const updateQuery = supabase.from('notifications')
    const withUpdate = safeUpdate(updateQuery, { is_read: true, read_at: new Date().toISOString() })
    const withUserFilter = safeEq(withUpdate, 'user_id', userId)
    const withReadFilter = safeEq(withUserFilter, 'is_read', false)
    const { error: updateError } = await withReadFilter
    
    if (updateError) {
      logger.error('Failed to mark all notifications as read', updateError, { userId })
      return NextResponse.json(
        { error: 'Failed to update notifications', details: updateError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'All notifications marked as read',
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Mark all notifications read error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
