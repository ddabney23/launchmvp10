import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { requireAdminUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/admin/badges - Get all available badges
export const GET = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate admin with Clerk
  let userId: string
  try {
    userId = await requireAdminUserId()
  } catch (authError) {
    const message = authError instanceof Error ? authError.message : 'Unauthorized'
    if (message === 'Forbidden') {
      return forbiddenResponse('Admin access required')
    }
    return unauthorizedResponse('Authentication failed', message)
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = createAdminClient()

  // Get all badges (optimized: select specific fields)
  const { data: badges, error } = await supabase
    .from('badges')
    .select('id, name, description, icon, tier, points_required, created_at')
    .order('name')
    .limit(100) // Safety limit

  if (error) {
    logger.error('Failed to fetch badges', error)
    return internalErrorResponse('Failed to fetch badges', error)
  }

  return successResponse({ badges: badges || [] })
})
