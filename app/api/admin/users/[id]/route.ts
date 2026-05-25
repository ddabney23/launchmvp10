// Admin API route for managing individual users
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  safeJsonParse,
  validateRequest,
  successResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { safeEq, safeUpdate, hasProperty } from '@/lib/supabase-helpers'
import type { UserStats } from '@/types'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Schema for user update
const UserUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  is_vendor: z.boolean().optional(),
  vendor_verified: z.boolean().optional(),
  is_admin: z.boolean().optional(),
  points: z.number().int().min(0).optional(),
  credits: z.number().min(0).optional(),
  reputation_score: z.number().min(0).optional(),
  account_status: z.enum(['active', 'suspended', 'banned']).optional(),
  admin_notes: z.string().optional().nullable(),
})

/**
 * GET /api/admin/users/[id]
 * Get detailed user information (admin only)
 */
export const GET = withErrorHandling(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  // Authenticate admin
  let adminUserId: string
  try {
    adminUserId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in admin user GET', authError)
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

    // Check if user is admin
    const { data: adminProfile, error: adminCheckError } = await adminClient
      .from('profiles')
      .select('is_admin')
      .eq('id', adminUserId)
      .maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    const { id: userId } = await params
    
    logger.info('Fetching user profile by Clerk ID', { userId, adminUserId })

    // Always use Clerk ID to fetch profile (simpler and more reliable)
    // The userId parameter should be a Clerk ID (starts with "user_")
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(`
        *,
        vendor_profile:vendor_profiles(
          id,
          business_name,
          business_email,
          business_phone,
          stripe_onboard_status,
          payout_balance,
          subscription_tier,
          subscription_status,
          listing_limit,
          transaction_fee_percent
        )
      `)
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      logger.error('Failed to fetch user profile by Clerk ID', profileError, { 
        userId, 
        errorCode: profileError.code, 
        errorMessage: profileError.message,
        errorDetails: profileError.details,
        errorHint: profileError.hint,
      })
      return internalErrorResponse('Failed to fetch user profile', {
        error: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint,
        userId,
        searchedBy: 'id',
      })
    }

    if (!profile) {
      logger.warn('User profile not found by Clerk ID', { userId })
      return notFoundResponse('User not found', { 
        userId,
        searchedBy: 'id',
        message: `No profile found with Clerk ID: ${userId}. The user may not have completed their profile setup.`
      })
    }
    
    logger.info('User profile fetched successfully', { userId, profileId: profile.id, hasVendorProfile: !!profile.vendor_profile })

    // Get user statistics - handle errors gracefully
    // Use profile.id (UUID) for queries since database tables reference profile UUIDs, not Clerk IDs
    const profileId = profile.id
    
    const [postsResult, listingsResult, ordersResult, followersResult, followingResult] = await Promise.allSettled([
      adminClient.from('posts').select('id', { count: 'exact', head: true }).eq('author', profileId),
      adminClient.from('listings').select('id', { count: 'exact', head: true }).eq('vendor', profileId),
      adminClient.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', profileId),
      adminClient.from('follows').select('id', { count: 'exact', head: true }).eq('following', profileId),
      adminClient.from('follows').select('id', { count: 'exact', head: true }).eq('follower', profileId),
    ])
    
    const postsCount = postsResult.status === 'fulfilled' ? postsResult.value : { count: 0, error: null }
    const listingsCount = listingsResult.status === 'fulfilled' ? listingsResult.value : { count: 0, error: null }
    const ordersCount = ordersResult.status === 'fulfilled' ? ordersResult.value : { count: 0, error: null }
    const followersCount = followersResult.status === 'fulfilled' ? followersResult.value : { count: 0, error: null }
    const followingCount = followingResult.status === 'fulfilled' ? followingResult.value : { count: 0, error: null }

    const stats: UserStats = {
      posts_count: postsCount.count || 0,
      listings_count: listingsCount.count || 0,
      orders_count: ordersCount.count || 0,
      followers_count: followersCount.count || 0,
      following_count: followingCount.count || 0,
    }

    // Get recent activity (last 10 posts) - handle errors gracefully
    // Use profile.id (UUID) for the query
    const { data: recentPosts, error: recentPostsError } = await adminClient
      .from('posts')
      .select('id, content, created_at')
      .eq('author', profileId)
      .order('created_at', { ascending: false })
      .limit(10)
      .catch(() => ({ data: [], error: null }))
    
    if (recentPostsError) {
      logger.warn('Failed to fetch recent posts', recentPostsError, { userId })
    }

    // Get vendor application if exists - handle errors gracefully
    // Use profile.id (UUID) for the query since vendor_applications.user_id is a profile UUID
    let vendorApplication = null
    if ('is_vendor' in profile && 'vendor_verified' in profile) {
      if (profile.is_vendor || profile.vendor_verified) {
        try {
          const { data: application, error: applicationError } = await adminClient
            .from('vendor_applications')
            .select('*')
            .eq('user_id', profileId)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (applicationError) {
            logger.warn('Failed to fetch vendor application', applicationError, { userId })
          } else {
            vendorApplication = application
          }
        } catch (error) {
          logger.warn('Error fetching vendor application', error, { userId })
          // Continue without vendor application data
        }
      }
    }

    logger.info('Returning user profile data', { 
      userId, 
      hasProfile: !!profile,
      statsCount: Object.keys(stats).length,
      recentPostsCount: (recentPosts || []).length,
      hasVendorApplication: !!vendorApplication,
    })

    return successResponse({
      profile,
      stats,
      recent_posts: recentPosts || [],
      vendor_application: vendorApplication,
    })
})

/**
 * PATCH /api/admin/users/[id]
 * Update user profile (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate admin
    const adminUserId = await getAuthUserId()
    const adminClient = createAdminClient()

    // Check if user is admin
    const { data: adminProfile, error: adminCheckError } = await safeEq(
      adminClient
        .from('profiles')
        .select('is_admin'),
      'id',
      adminUserId
    ).maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    const { id: userId } = await params

    // Parse and validate request body
    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    let updates: z.infer<typeof UserUpdateSchema>
    try {
      updates = validateRequest(UserUpdateSchema, body)
    } catch (validationError) {
      if (validationError instanceof NextResponse) {
        return validationError
      }
      throw validationError
    }

    // Prevent admin from removing their own admin status
    if (userId === adminUserId && updates.is_admin === false) {
      return errorResponse('Cannot remove your own admin privileges', 'INVALID_OPERATION')
    }

    // Update user profile
    const profileUpdate = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { data: updatedProfile, error: updateError } = await safeEq(
      safeUpdate(
        adminClient.from('profiles'),
        profileUpdate
      ),
      'id',
      userId
    )
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Failed to update user profile', updateError, { userId, updates })
      return internalErrorResponse('Failed to update user profile', updateError)
    }

    if (!updatedProfile) {
      return notFoundResponse('User not found')
    }

    // If vendor status changed, handle vendor profile
    if (updates.is_vendor !== undefined || updates.vendor_verified !== undefined) {
      if (updates.is_vendor && updates.vendor_verified) {
        // Check if vendor profile exists
        const { data: existingVendorProfile } = await safeEq(
          adminClient
            .from('vendor_profiles')
            .select('id'),
          'id',
          userId
        ).maybeSingle()

        // Create vendor profile if it doesn't exist
        if (!existingVendorProfile) {
          const businessName = hasProperty(updatedProfile, 'display_name') && updatedProfile.display_name ? updatedProfile.display_name : 'New Vendor'
          const { error: vendorProfileError } = await adminClient
            .from('vendor_profiles')
            // @ts-expect-error - Supabase insert type inference issue with strict mode
            .insert({
              id: userId,
              business_name: businessName,
            })
          
          if (vendorProfileError) {
            logger.error('Failed to create vendor profile', vendorProfileError, { userId })
          }
        }
      }
    }

    // Log audit event (non-blocking)
    try {
      await adminClient
        .from('audit_logs')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: adminUserId,
          action: 'user_updated',
          resource_type: 'user',
          resource_id: userId,
          details: {
            updates: Object.keys(updates),
            admin_id: adminUserId,
          },
        })
    } catch (auditError) {
      logger.error('Failed to log audit event', auditError, { userId, adminUserId })
    }

    // Send notification to user about profile changes (non-blocking)
    try {
      const changesSummary = Object.keys(updates).join(', ')
      await adminClient
        .from('notifications')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: userId,
          type: 'profile_updated',
          data: {
            title: 'Profile Updated by Admin',
            message: `Your profile has been updated by an administrator. Changes: ${changesSummary}`,
          },
        })
    } catch (notificationError) {
      logger.error('Failed to send notification', notificationError, { userId })
    }

    return successResponse(
      { profile: updatedProfile },
      'User profile updated successfully'
    )

  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error
    }
    logger.error('Admin user PATCH error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user account (admin only)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate admin
    const adminUserId = await getAuthUserId()
    const adminClient = createAdminClient()

    // Check if user is admin
    const { data: adminProfile, error: adminCheckError } = await safeEq(
      adminClient
        .from('profiles')
        .select('is_admin'),
      'id',
      adminUserId
    ).maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    const { id: userId } = await params

    // Prevent admin from deleting themselves
    if (userId === adminUserId) {
      return errorResponse('Cannot delete your own account', 'INVALID_OPERATION')
    }

    // Check if user exists
    const { data: userProfile, error: userFetchError } = await safeEq(
      adminClient
        .from('profiles')
        .select('id, username, email, is_admin'),
      'id',
      userId
    ).maybeSingle()

    if (userFetchError) {
      logger.error('Failed to fetch user profile for deletion', userFetchError, { userId })
      return internalErrorResponse('Failed to fetch user profile', userFetchError)
    }

    if (!userProfile) {
      return notFoundResponse('User not found')
    }

    // Prevent deleting other admins
    if (hasProperty(userProfile, 'is_admin') && userProfile.is_admin) {
      return errorResponse('Cannot delete admin accounts. Remove admin privileges first.', 'INVALID_OPERATION')
    }

    // Log audit event before deletion (non-blocking)
    try {
      const username = hasProperty(userProfile, 'username') && userProfile.username ? userProfile.username : 'unknown'
      const email = hasProperty(userProfile, 'email') && userProfile.email ? userProfile.email : 'unknown'
      await adminClient
        .from('audit_logs')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: adminUserId,
          action: 'user_deleted',
          resource_type: 'user',
          resource_id: userId,
          details: {
            deleted_user: {
              id: userId,
              username,
              email,
            },
            admin_id: adminUserId,
          },
        })
    } catch (auditError) {
      logger.error('Failed to log user deletion audit event', auditError, { userId, adminUserId })
    }

    // Delete user profile (CASCADE will handle related data)
    const { error: deleteError } = await safeEq(
      adminClient
        .from('profiles')
        .delete(),
      'id',
      userId
    )

    if (deleteError) {
      logger.error('Failed to delete user profile', deleteError, { userId })
      return internalErrorResponse('Failed to delete user profile', deleteError)
    }

    return successResponse(
      { deletedUserId: userId },
      'User account deleted successfully'
    )

  } catch (error: unknown) {
    if (error instanceof NextResponse) {
      return error
    }
    logger.error('Admin user DELETE error', error)
    return internalErrorResponse('Internal server error', error)
  }
}
