// Admin API route for searching users
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { safeEq, hasProperty } from '@/lib/supabase-helpers'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/search
 * Search users with filters (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate admin
    let adminUserId: string
    try {
      adminUserId = await getAuthUserId()
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Strict rate limit for admin operations (10/min)
    const rateLimitResponse = await strictRateLimit(req, adminUserId)
    if (rateLimitResponse) return rateLimitResponse
    
    const adminClient = createAdminClient()

    // Check if user is admin
    const { data: adminProfile } = await safeEq(
      adminClient
        .from('profiles')
        .select('is_admin'),
      'id',
      adminUserId
    ).maybeSingle()

    if (!(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || '' // Search query
    const role = searchParams.get('role') // vendor/customer/admin
    const status = searchParams.get('status') // active/suspended/banned
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build the query
    let dbQuery = adminClient
      .from('profiles')
      .select(`
        *,
        vendor_profile:vendor_profiles(
          id,
          business_name,
          business_email,
          stripe_onboard_status
        )
      `, { count: 'exact' })

    // Apply search filters
    if (query) {
      dbQuery = dbQuery.or(`username.ilike.%${query}%,display_name.ilike.%${query}%,email.ilike.%${query}%,id.eq.${query}`)
    }

    // Filter by role
    if (role === 'vendor') {
      dbQuery = safeEq(dbQuery, 'is_vendor', true)
    } else if (role === 'admin') {
      dbQuery = safeEq(dbQuery, 'is_admin', true)
    } else if (role === 'customer') {
      dbQuery = safeEq(dbQuery, 'is_vendor', false)
    }

    // Filter by status
    if (status) {
      dbQuery = safeEq(dbQuery, 'account_status', status)
    }

    // Apply pagination
    dbQuery = dbQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: users, error, count } = await dbQuery

    if (error) {
      logger.error('Failed to search users', error, { query, role, status })
      return NextResponse.json(
        { error: 'Failed to search users', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      users: users || [],
      total: count || 0,
      limit,
      offset,
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Admin user search error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
