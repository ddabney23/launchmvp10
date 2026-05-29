import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (req: NextRequest) => {
  let userId: string

  try {
    userId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in profile me', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.error('Failed to fetch profile', error, { userId })
    return internalErrorResponse('Failed to fetch profile', error)
  }

  if (!profile) {
    return notFoundResponse('Profile not found')
  }

  return successResponse(profile)
})
