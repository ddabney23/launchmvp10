// CLERK MIGRATION: API route for admin to view and manage vendor applications
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { isAdmin } from '@/types'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vendor/applications
 * Get all vendor applications (admin only)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate admin with Clerk
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in vendor applications', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated read: 100/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  // Check if user is admin
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

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'pending', 'approved', 'denied'

    // Build query
    let query = adminClient
      .from('vendor_applications')
      .select(`
        *,
        profile:profiles!vendor_applications_user_id_fkey(
          id,
          username,
          display_name,
          email,
          avatar_url,
          created_at
        )
      `)
      .order('submitted_at', { ascending: false })

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

  const { data: applications, error } = await query

  if (error) {
    logger.error('Failed to fetch vendor applications', error, { userId, status })
    
    // Handle schema cache errors
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      return errorResponse(
        'Table not found. The vendor_applications table may not exist yet.',
        'TABLE_NOT_FOUND',
        {
          details: 'Please ensure the migration has been applied: supabase/migrations/025_vendor_applications.sql',
          code: error.code,
        }
      )
    }
    
    return internalErrorResponse('Failed to fetch applications', error)
  }

  return successResponse({ applications: applications || [] })
})

