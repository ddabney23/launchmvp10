// CLERK MIGRATION: API route for admin to approve/deny vendor applications
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { strictRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  validationErrorResponse,
  internalErrorResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

// Schema for approve/deny request
const VendorApplicationActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
  message: z.string().max(1000).optional(), // Optional message for denial reason
})

/**
 * PATCH /api/vendor/applications/[id]
 * Approve or deny a vendor application (admin only)
 */
export const PATCH = withErrorHandling(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // CLERK MIGRATION: Authenticate admin with Clerk
  let adminUserId: string
  try {
    adminUserId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in vendor application action', authError)
    return errorResponse(
      'Authentication failed',
      'UNAUTHORIZED',
      authError instanceof Error ? authError.message : 'Unauthorized',
      401
    )
  }

  // Strict rate limit check (admin: 10/min)
  const rateLimitResponse = await strictRateLimit(req, adminUserId)
  if (rateLimitResponse) return rateLimitResponse
  
  const adminClient = createAdminClient()

  // Check if user is admin - lookup by id
  const { data: adminProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', adminUserId)
    .maybeSingle()

  if (profileError) {
    logger.error('Failed to fetch admin profile', profileError, { adminUserId })
    return internalErrorResponse('Failed to verify admin status', profileError)
  }

  if (!adminProfile?.is_admin) {
    return forbiddenResponse('Admin access required')
  }

  const adminProfileId = adminProfile.id // Profile UUID for reviewed_by field

    const { id: applicationId } = await params

    // Parse and validate request body
    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const validationResult = VendorApplicationActionSchema.safeParse(body)
    if (!validationResult.success) {
      return validationErrorResponse(validationResult.error)
    }

    const { action, message } = validationResult.data

    // Get the application (optimized: specific fields)
    const { data: application, error: fetchError } = await adminClient
      .from('vendor_applications')
      .select(`
        id,
        user_id,
        business_name,
        business_type,
        status,
        submitted_at,
        reviewed_at
      `)
      .eq('id', applicationId)
      .maybeSingle()

    if (fetchError) {
      logger.error('Failed to fetch vendor application', fetchError, { applicationId })
      return internalErrorResponse('Failed to fetch application', fetchError)
    }

    if (!application) {
      return errorResponse('Application not found', 'NOT_FOUND', { applicationId }, 404)
    }

    // Get vendor's profile to get their Clerk ID for notification link
    const { data: vendorProfile, error: vendorProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', application.user_id)
      .maybeSingle()

    if (vendorProfileError) {
      logger.warn('Failed to fetch vendor profile for notification link', vendorProfileError, { 
        userId: application.user_id 
      })
    }

    // Update application status
    const newStatus = action === 'approve' ? 'approved' : 'denied'
    const updateData: any = {
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminProfileId, // Use profile UUID, not Clerk ID
    }

    // Add denial message if provided
    if (action === 'deny' && message) {
      updateData.denial_reason = message
    }

    const { data: updatedApplication, error: updateError } = await adminClient
      .from('vendor_applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Failed to update vendor application', updateError, { applicationId, action })
      return internalErrorResponse('Failed to update application', updateError)
    }

    // If approved, update profile to mark as verified vendor
    if (action === 'approve') {
      const { error: profileUpdateError } = await adminClient
        .from('profiles')
        .update({ 
          is_vendor: true,
          vendor_verified: true,
        })
        .eq('id', application.user_id)

      if (profileUpdateError) {
        logger.error('Failed to update profile after approval', profileUpdateError, { 
          applicationId, 
          userId: application.user_id 
        })
        // Don't fail the request - application was already updated, but log the error
      }

      // Create vendor profile if it doesn't exist
      const { data: existingVendorProfile, error: checkError } = await adminClient
        .from('vendor_profiles')
        .select('id')
        .eq('id', application.user_id)
        .maybeSingle()

      if (checkError) {
        logger.error('Failed to check existing vendor profile', checkError, { 
          applicationId, 
          userId: application.user_id 
        })
        // Continue anyway - might not exist yet
      }

      if (!existingVendorProfile) {
        const { error: vendorProfileError } = await adminClient
          .from('vendor_profiles')
          .insert({
            id: application.user_id,
            business_name: application.business_name,
            business_email: application.phone_number || null, // Use phone as placeholder
            business_phone: application.phone_number || null,
            business_address: application.business_address || {},
            documents: [],
            payout_balance: 0,
            stripe_onboard_status: 'not_started',
          })

        if (vendorProfileError) {
          logger.error('Failed to create vendor profile after approval', vendorProfileError, { 
            applicationId, 
            userId: application.user_id 
          })
          // Don't fail the request - profile was updated, vendor profile can be created later
        }
      }
    }

    // Create notification for the vendor
    // Use Clerk ID for the link if available, fallback to profile UUID
    const vendorProfileId = vendorProfile?.id || application.user_id
    const notificationData: any = {
      user_id: application.user_id, // Notification user_id is profile UUID
      type: action === 'approve' ? 'vendor_verification_approved' : 'vendor_verification_denied',
      data: {
        applicationId: application.id,
        title: action === 'approve' 
          ? 'Vendor Application Approved!' 
          : 'Vendor Application Denied',
        message: action === 'approve'
          ? 'Congratulations! Your vendor application has been approved. You can now access your vendor dashboard.'
          : message || 'Your vendor application has been denied. Please contact support for more information.',
        link: action === 'approve' ? `/vendor/${vendorProfileId}` : undefined,
      },
    }

    if (action === 'deny' && message) {
      notificationData.data.denialReason = message
    }

    const { error: notificationError } = await adminClient
      .from('notifications')
      .insert(notificationData)

    if (notificationError) {
      logger.error('Failed to create notification', notificationError, { applicationId, action })
      // Don't fail the request - notification is non-critical
    }

    return successResponse(
      { application: updatedApplication },
      `Application ${action === 'approve' ? 'approved' : 'denied'} successfully`
    )
})

