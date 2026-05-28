// Admin API route for searching users
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { requireAdminUserId } from '@/lib/supabase-auth'
import { escapeIlikePattern } from '@/lib/postgrest-sanitize'
import { logger } from '@/lib/logger'
import { safeEq } from '@/lib/supabase-helpers'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * GET /api/admin/users/search
 * Search users with filters (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    let adminUserId: string
    try {
      adminUserId = await requireAdminUserId()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      return NextResponse.json(
        {
          error:
            message === 'Forbidden'
              ? 'Forbidden. Admin access required.'
              : 'Unauthorized. Please sign in.',
        },
        { status: message === 'Forbidden' ? 403 : 401 }
      )
    }

    const rateLimitResponse = await strictRateLimit(req, adminUserId)
    if (rateLimitResponse) return rateLimitResponse

    const adminClient = createAdminClient()

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
      const trimmed = query.trim()
      if (UUID_RE.test(trimmed)) {
        dbQuery = dbQuery.eq('id', trimmed)
      } else {
        const safe = escapeIlikePattern(trimmed)
        dbQuery = dbQuery.or(
          `username.ilike.%${safe}%,display_name.ilike.%${safe}%,email.ilike.%${safe}%`
        )
      }
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
