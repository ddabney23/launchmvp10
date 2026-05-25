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
import { strictRateLimit } from '@/lib/rate-limit'
import { hasProperty, safeEq } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

// GET /api/admin/badges - Get all available badges
export const GET = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate admin with Clerk
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in admin badges', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Strict rate limit check (admin: 10/min)
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = createAdminClient()

  // Check if requester is admin - lookup by id
  const { data: adminProfile } = await safeEq(
    supabase.from('profiles').select('is_admin'),
      'id',
    userId
  ).maybeSingle()

  if (!(adminProfile && hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
    return forbiddenResponse('Admin access required')
  }

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
