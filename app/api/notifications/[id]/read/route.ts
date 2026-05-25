/**
 * Mark Notification as Read
 * PATCH /api/notifications/[id]/read - Mark specific notification as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { safeEq, safeUpdate } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/notifications/[id]/read
 * Mark a notification as read
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Rate limit check (authenticated write: 30/min)
    const rateLimitResponse = await rateLimit(req, { userId })
    if (rateLimitResponse) return rateLimitResponse
    
    const supabase = await createServerClient()
    const { id: notificationId } = await params
    
    // Update notification (only if it belongs to the user)
    const updateQuery = supabase.from('notifications')
    const withUpdate = safeUpdate(updateQuery, { is_read: true, read_at: new Date().toISOString() })
    const withIdFilter = safeEq(withUpdate, 'id', notificationId)
    const withUserFilter = safeEq(withIdFilter, 'user_id', userId)
    const { error: updateError } = await withUserFilter
    
    if (updateError) {
      logger.error('Failed to mark notification as read', updateError, { notificationId, userId })
      return NextResponse.json(
        { error: 'Failed to update notification', details: updateError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: 'Notification marked as read',
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Mark notification read error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
