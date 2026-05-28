// Admin API route for exporting user data
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { requireAdminUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { safeEq } from '@/lib/supabase-helpers'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users/export
 * Export users to CSV (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate admin
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

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const format = searchParams.get('format') || 'csv' // csv or json

    // Build the query
    let query = adminClient
      .from('profiles')
      .select(`
        id,
        username,
        display_name,
        email,
        phone,
        bio,
        city,
        state,
        school,
        is_vendor,
        vendor_verified,
        is_admin,
        points,
        credits,
        reputation_score,
        account_status,
        created_at,
        updated_at
      `)

    // Apply filters
    if (role === 'vendor') {
      query = safeEq(query, 'is_vendor', true)
    } else if (role === 'admin') {
      query = safeEq(query, 'is_admin', true)
    } else if (role === 'customer') {
      query = safeEq(query, 'is_vendor', false)
    }

    if (status) {
      query = safeEq(query, 'account_status', status)
    }

    query = query.order('created_at', { ascending: false })

    const { data: users, error } = await query

    if (error) {
      logger.error('Failed to export users', error)
      return NextResponse.json(
        { error: 'Failed to export users', details: error.message },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'No users found to export' },
        { status: 404 }
      )
    }

    // Log audit event
    await adminClient
      .from('audit_logs')
      // @ts-expect-error - Supabase generated types conflict with Insert type
      .insert({
        user_id: adminUserId,
        action: 'users_exported',
        resource_type: 'user',
        resource_id: null,
        details: {
          count: users.length,
          format,
          filters: { role, status },
        },
      })

    if (format === 'json') {
      return NextResponse.json({
        users,
        exported_at: new Date().toISOString(),
        total: users.length,
      })
    }

    // Generate CSV
    const headers = [
      'ID',
      'Username',
      'Display Name',
      'Email',
      'Phone',
      'Bio',
      'City',
      'State',
      'School',
      'Is Vendor',
      'Vendor Verified',
      'Is Admin',
      'Points',
      'Credits',
      'Reputation Score',
      'Account Status',
      'Created At',
      'Updated At',
    ]

    // Filter out any potential error types and ensure we have valid user objects
    type UserRow = {
      id: string;
      username: string;
      display_name: string | null;
      email: string | null;
      phone: string | null;
      bio: string | null;
      city: string | null;
      state: string | null;
      school: string | null;
      is_vendor: boolean;
      vendor_verified: boolean;
      is_admin: boolean | null;
      points: number;
      credits: number;
      reputation_score: number;
      account_status: string | null;
      created_at: string | null;
      updated_at: string | null;
    }
    
    // Type assertion is safe because we already checked for errors above
    const validUsers = users as UserRow[]

    const csvRows = [
      headers.join(','),
      ...validUsers.map((user) =>
        [
          user.id,
          `"${(user.username || '').replace(/"/g, '""')}"`,
          `"${(user.display_name || '').replace(/"/g, '""')}"`,
          user.email || '',
          user.phone || '',
          `"${(user.bio || '').replace(/"/g, '""')}"`,
          user.city || '',
          user.state || '',
          user.school || '',
          user.is_vendor ? 'Yes' : 'No',
          user.vendor_verified ? 'Yes' : 'No',
          user.is_admin ? 'Yes' : 'No',
          user.points || 0,
          user.credits || 0,
          user.reputation_score || 0,
          user.account_status || 'active',
          user.created_at || '',
          user.updated_at || '',
        ].join(',')
      ),
    ]

    const csv = csvRows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Admin user export error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
