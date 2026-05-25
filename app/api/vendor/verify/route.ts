// Supabase Auth
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId, getAuthUser } from '@/lib/supabase-auth'
import { VendorVerificationSchema } from '@/lib/validations/schemas'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { safeEq, safeInsert, safeUpdate } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/vendor/verify
 * Submit vendor verification application
 * Stores verification documents and business info
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  // Authenticate user
  let userId: string
  let user: Awaited<ReturnType<typeof getAuthUser>>

  try {
    userId = await getAuthUserId() // Throws if not authenticated
    user = await getAuthUser() // Fetch full user object for email + metadata
  } catch (authError) {
    const errorMessage = authError instanceof Error ? authError.message : 'Unauthorized'
    logger.error('Authentication error in vendor verify', {
      error: errorMessage,
      errorType: authError?.constructor?.name,
      stack: authError instanceof Error ? authError.stack : undefined,
      headers: Object.fromEntries(req.headers.entries()),
    })
    return unauthorizedResponse(
      'Authentication failed',
      errorMessage
    )
  }

  // Strict rate limit check (vendor verification: 10/min)
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const verificationData = validateRequest(VendorVerificationSchema, body)

  // Use admin client for vendor applications table
  const adminClient = createAdminClient()

  // Profile id matches auth user id
  let { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, follower_count')
    .eq('id', userId)
    .maybeSingle()

  // If profile doesn't exist, create it (webhook might not have fired yet)
  if (!profile) {
    logger.warn('Profile not found for vendor verification, creating it', { userId })
    
    const email = user?.email || ''
    const emailPrefix = email.split('@')[0] || `user_${Date.now()}`
    
    // Ensure unique username
    let username = emailPrefix
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      
      if (!existing) break
      username = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`
      attempts++
    }

    const newProfileData: Record<string, unknown> = {
      id: userId,
      username: username,
      display_name:
        (user?.user_metadata?.display_name as string) ||
        (user?.user_metadata?.full_name as string) ||
        emailPrefix ||
        'User',
      email: email,
      avatar_url: (user?.user_metadata?.avatar_url as string) || null,
      bio: null,
      is_vendor: false, // Will be set to true after verification
      vendor_verified: false,
      onboarding_completed: false,
      credits: 0,
    }

    const { data: newProfile, error: createError } = await adminClient
      .from('profiles')
      .insert(newProfileData)
      .select('id, follower_count')
      .single()

    if (createError || !newProfile) {
      logger.error('Failed to create profile during vendor verification', createError, { userId })
      return internalErrorResponse('Failed to create user profile', createError || new Error('Profile creation returned no data'))
    }

    profile = newProfile
    logger.info('Created profile during vendor verification', { userId, profileId: profile.id })
  } else if (profileError) {
    logger.error('Failed to fetch profile for verification check', { 
      userId, 
      error: profileError,
      message: profileError?.message,
      details: profileError?.details,
      hint: profileError?.hint
    })
    return internalErrorResponse('Failed to fetch user profile', {
      userId,
      error: profileError?.message || 'Database error'
    })
  }

  // Check vendor requirements (minimum 100 followers) - optional, don't fail if RPC doesn't exist
  try {
    const { data: requirements, error: rpcError } = await adminClient
      .rpc('check_vendor_requirements', { user_uuid: profile.id })
      .single()

    // If RPC doesn't exist or fails, log but continue (for development/testing)
    if (rpcError) {
      logger.warn('Vendor requirements check RPC failed or does not exist', { 
        error: rpcError, 
        profileId: profile.id,
        message: 'Continuing without requirements check'
      })
    } else if (requirements && !requirements.meets_requirements) {
      return errorResponse(
        'You do not meet the minimum requirements for vendor verification',
        'REQUIREMENTS_NOT_MET',
        {
          follower_count: requirements.follower_count,
          missing_requirements: requirements.missing_requirements,
        }
      )
    }
  } catch (rpcException) {
    // RPC function might not exist - log and continue
    logger.warn('Vendor requirements check exception', { 
      error: rpcException, 
      profileId: profile.id,
      message: 'Continuing without requirements check'
    })
  }

  // Check if user already has a pending application
  const { data: existingApplication } = await adminClient
    .from('vendor_applications')
    .select('id, status')
    .eq('user_id', profile.id) // Use profile UUID, not Clerk ID
    .in('status', ['pending', 'approved'])
    .maybeSingle()

  if (existingApplication) {
    if (existingApplication.status === 'pending') {
      return errorResponse('You already have a pending verification application', 'DUPLICATE_APPLICATION')
    }
    if (existingApplication.status === 'approved') {
      return errorResponse('You are already a verified vendor', 'ALREADY_VERIFIED')
    }
  }

  // Prepare business address (ensure all fields are present)
  const businessAddress = verificationData.businessAddress || {}
  const addressData = {
    street: businessAddress.street || '',
    city: businessAddress.city || '',
    state: businessAddress.state || '',
    zip: businessAddress.zip || '',
    country: businessAddress.country || 'US',
  }

  // Create vendor application
  const { data: application, error: applicationError } = await safeInsert(
    adminClient.from('vendor_applications'),
    {
      user_id: profile.id, // Use the profile UUID, not the Clerk ID
      business_name: verificationData.businessName,
      business_type: verificationData.businessType,
      tax_id: verificationData.taxId || null,
      business_address: addressData,
      phone_number: verificationData.phoneNumber || '+1234567890',
      id_document_url: verificationData.idDocumentUrl || null,
      business_license_url: verificationData.businessLicenseUrl || null,
      additional_documents: verificationData.additionalDocuments || [],
      notes: verificationData.notes || null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    }
  )
    .select()
    .maybeSingle()

  if (applicationError) {
    logger.error('Failed to create vendor application', { userId, profileId: profile.id, verificationData, error: applicationError })
    
    // Check if it's a "relation does not exist" error (table doesn't exist)
    if (applicationError.code === '42P01' || applicationError.message?.includes('does not exist')) {
      return internalErrorResponse(
        'Database table not found',
        {
          details: 'The vendor_applications table does not exist. Please run the migration: supabase/migrations/025_vendor_applications.sql',
          code: applicationError.code,
          hint: applicationError.hint,
        }
      )
    }

    return internalErrorResponse(
      'Failed to submit verification application',
      {
        message: applicationError.message,
        code: applicationError.code,
        hint: applicationError.hint,
      }
    )
  }

  if (!application) {
    return internalErrorResponse('Failed to create application. Please try again.')
  }

  // Update user profile to mark as vendor (but not verified yet) - using profile from earlier fetch
  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ is_vendor: true })
    .eq('id', profile.id)

  if (profileUpdateError) {
    logger.error('Failed to update profile', profileUpdateError, { userId, profileId: profile.id })
    // Don't fail the request - application was created successfully
  }

  // Create notification for admin (non-blocking - don't fail if this fails)
  try {
    const { data: admins } = await adminClient
      .from('profiles')
      .select('id')
      .eq('is_admin', true)

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map((admin) => ({
        user_id: admin.id,
        type: 'vendor_verification_request',
        data: {
          applicationId: application.id,
          userId: userId,
          businessName: verificationData.businessName,
          title: 'New Vendor Verification Request',
          message: `${user?.email || 'A user'} has submitted a vendor verification application.`,
        },
      }))

      await safeInsert(adminClient.from('notifications'), adminNotifications)
    }
  } catch (notificationError) {
    logger.error('Failed to create admin notifications', notificationError, { userId })
    // Don't fail the request - application was created successfully
  }

  // Create notification for user (non-blocking - don't fail if this fails)
  try {
    await safeInsert(adminClient.from('notifications'), {
      user_id: profile.id, // Use profile UUID, not Clerk ID
      type: 'vendor_application_submitted',
      data: {
        applicationId: application.id,
        title: 'Verification Application Submitted',
        message: 'Your vendor verification application has been submitted and is under review.',
      },
    })
  } catch (notificationError) {
    logger.error('Failed to create user notification', { userId, profileId: profile.id, error: notificationError })
    // Don't fail the request - application was created successfully
  }

  return successResponse(
    { application },
    'Verification application submitted successfully. You will be notified once it is reviewed.'
  )
})

/**
 * GET /api/vendor/verify
 * Get vendor verification status for current user
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  // Authenticate user
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in vendor verify GET', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  const adminClient = createAdminClient()

  let { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_vendor, vendor_verified')
    .eq('id', userId)
    .maybeSingle()

  // If profile doesn't exist, create it (webhook might not have fired yet)
  if (!profile) {
    logger.warn('Profile not found in vendor verify GET, creating it', { userId })
    
    try {
      const authUser = await getAuthUser()
      const email = authUser?.email || ''
      const meta = authUser?.user_metadata || {}
      const emailPrefix = email.split('@')[0] || `user_${Date.now()}`
      
      // Ensure unique username
      let username = emailPrefix
      let attempts = 0
      while (attempts < 5) {
        const { data: existing } = await adminClient
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle()
        
        if (!existing) break
        username = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`
        attempts++
      }

      const newProfileData: Record<string, unknown> = {
        id: userId,
        username: username,
        display_name:
          (meta.display_name as string) ||
          (meta.full_name as string) ||
          emailPrefix ||
          'User',
        email: email,
        avatar_url: (meta.avatar_url as string) || null,
        bio: null,
        is_vendor: false,
        vendor_verified: false,
        onboarding_completed: false,
        credits: 0,
      }

      const { data: newProfile, error: createError } = await adminClient
        .from('profiles')
        .insert(newProfileData)
        .select('id, is_vendor, vendor_verified')
        .single()

      if (createError || !newProfile) {
        logger.error('Failed to create profile in vendor verify GET', createError, { userId })
        return internalErrorResponse('Failed to create user profile', createError || new Error('Profile creation returned no data'))
      }

      profile = newProfile
      logger.info('Created profile in vendor verify GET', { userId, profileId: profile.id })
    } catch (createError) {
      logger.error('Error creating profile in vendor verify GET', createError, { userId })
      return internalErrorResponse('Failed to create user profile', createError)
    }
  } else if (profileError) {
    logger.error('Failed to fetch profile in vendor verify GET', { userId, error: profileError })
    return internalErrorResponse('Failed to fetch user profile', {
      userId,
      error: profileError?.message || 'Database error'
    })
  }

  // Get user's vendor application using profile UUID (not Clerk ID)
  const { data: application, error: fetchError } = await adminClient
    .from('vendor_applications')
    .select('id, status, business_name, business_type, submitted_at, reviewed_at, notes, denial_reason')
    .eq('user_id', profile.id) // Use profile UUID, not Clerk ID
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    logger.error('Failed to fetch vendor application', fetchError, { userId, profileId: profile.id })
    return internalErrorResponse('Failed to fetch application status', fetchError)
  }

  return successResponse({
    hasApplication: !!application,
    application,
    isVendor: profile.is_vendor || false,
    isVerified: profile.vendor_verified || false,
  })
})

