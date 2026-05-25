// CLERK MIGRATION: Updated to use Clerk authentication
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { isAdmin } from '@/types'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// This endpoint allows storing and retrieving webhook logs
// In production, you might want to use a dedicated logging service

/**
 * GET /api/webhooks/logs
 * Get webhook logs (admin only)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in webhook logs', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated read: 100/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  // Check if admin
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    logger.error('Failed to check admin status', profileError, { userId })
    return internalErrorResponse('Failed to verify permissions', profileError)
  }

  if (!isAdmin(profile)) {
    return forbiddenResponse('Admin access required')
  }

  // Query webhook logs from database
  const { data: logs, error: fetchError } = await adminClient
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (fetchError) {
    logger.error('Failed to fetch webhook logs', fetchError)
    return internalErrorResponse('Failed to fetch webhook logs', fetchError)
  }

  return successResponse({ logs: logs || [] })
})

