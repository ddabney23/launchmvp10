// Admin API route for managing user roles
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { safeEq, safeUpdate, hasProperty } from '@/lib/supabase-helpers'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Schema for role update
const RoleUpdateSchema = z.object({
  is_vendor: z.boolean().optional(),
  vendor_verified: z.boolean().optional(),
  is_admin: z.boolean().optional(),
})

/**
 * PATCH /api/admin/users/[id]/roles
 * Update user roles (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate admin
    const adminUserId = await getAuthUserId()

    // Strict rate limit check (admin: 10/min)
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

    const { id: userId } = await params

    // Parse and validate request body
    const body = await req.json()
    const validationResult = RoleUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Prevent admin from removing their own admin status
    if (userId === adminUserId && updates.is_admin === false) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin privileges' },
        { status: 400 }
      )
    }

    // Update user roles
    const { data: updatedProfile, error: updateError } = await safeEq(
      safeUpdate(
        adminClient.from('profiles'),
        updates
      ),
      'id',
      userId
    )
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Failed to update user roles', updateError, { userId, updates })
      return NextResponse.json(
        { error: 'Failed to update user roles' },
        { status: 500 }
      )
    }

    // If promoted to verified vendor, ensure vendor profile exists
    if (updates.is_vendor && updates.vendor_verified) {
      const { data: existingVendorProfile } = await safeEq(
        adminClient
          .from('vendor_profiles')
          .select('id'),
        'id',
        userId
      ).maybeSingle()

      if (!existingVendorProfile) {
        const businessName = hasProperty(updatedProfile, 'display_name') && updatedProfile.display_name ? updatedProfile.display_name : 'New Vendor'
        await adminClient
          .from('vendor_profiles')
          // @ts-expect-error - Supabase insert type inference issue with strict mode
          .insert({
            id: userId,
            business_name: businessName,
            business_email: null,
            business_phone: null,
            business_address: {},
            documents: [],
            payout_balance: 0,
            stripe_onboard_status: 'not_started',
          })
      }
    }

    // Log audit event
    await adminClient
      .from('audit_logs')
      // @ts-expect-error - Supabase insert type inference issue with strict mode
      .insert({
        user_id: adminUserId,
        action: 'user_roles_updated',
        resource_type: 'user',
        resource_id: userId,
        details: {
          updates,
          admin_id: adminUserId,
        },
      })

    // Send notification
    const roleChanges = []
    if (updates.is_vendor !== undefined) roleChanges.push(updates.is_vendor ? 'Granted vendor access' : 'Removed vendor access')
    if (updates.vendor_verified !== undefined) roleChanges.push(updates.vendor_verified ? 'Verified as vendor' : 'Vendor verification removed')
    if (updates.is_admin !== undefined) roleChanges.push(updates.is_admin ? 'Granted admin privileges' : 'Removed admin privileges')

    if (roleChanges.length > 0) {
      await adminClient
        .from('notifications')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: userId,
          type: 'role_updated',
          data: {
            title: 'Account Roles Updated',
            message: `Your account roles have been updated: ${roleChanges.join(', ')}`,
          },
        })
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: 'User roles updated successfully',
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    logger.error('Admin role update error', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
