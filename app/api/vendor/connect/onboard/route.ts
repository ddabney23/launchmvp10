/**
 * Stripe Connect Onboarding API
 * Creates Stripe Connect account and onboarding link
 */

import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getAuthUserId, getAuthUser } from '@/lib/supabase-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
})

/**
 * POST /api/vendor/connect/onboard
 * Create or get Stripe Connect onboarding link
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse('Authentication required')
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  // Get vendor's profile UUID
  let { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_vendor, vendor_verified')
    .eq('id', userId)
    .maybeSingle()

  // If profile doesn't exist, create it (webhook might not have fired yet)
  if (!profile) {
    logger.warn('Profile not found for Stripe Connect onboarding, creating it', { userId })
    
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
        logger.error('Failed to create profile during Stripe Connect onboarding', createError, { userId })
        return internalErrorResponse('Failed to create user profile', createError || new Error('Profile creation returned no data'))
      }

      profile = newProfile
      logger.info('Created profile during Stripe Connect onboarding', { userId, profileId: profile.id })
    } catch (createError) {
      logger.error('Error creating profile during Stripe Connect onboarding', createError, { userId })
      return internalErrorResponse('Failed to create user profile', createError)
    }
  } else if (profileError) {
    logger.error('Failed to fetch profile', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  if (!profile.is_vendor) {
    return errorResponse('User is not a vendor', 'NOT_VENDOR', null, 403)
  }

  // Allow unverified vendors to start onboarding (they'll complete it after verification)
  // Note: They won't be able to receive payouts until verified, but can start the process

  // Get or create vendor profile
  let vendorProfile: any
  const { data: existingVendorProfile, error: vendorError } = await adminClient
    .from('vendor_profiles')
    .select('id, payout_account_id, stripe_onboard_status')
    .eq('id', profile.id)
    .maybeSingle()

  if (vendorError && vendorError.code !== 'PGRST116') {
    logger.error('Failed to fetch vendor profile', vendorError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch vendor profile', vendorError)
  }

  // If vendor profile doesn't exist, create it (for onboarding flow)
  if (!existingVendorProfile) {
    const { data: newVendorProfile, error: createError } = await adminClient
      .from('vendor_profiles')
      .insert({
        id: profile.id,
        business_name: 'Pending',
        payout_balance: 0,
        stripe_onboard_status: 'not_started',
      })
      .select()
      .single()

    if (createError) {
      logger.error('Failed to create vendor profile', createError, { vendorId: profile.id })
      // Continue anyway - might fail if table doesn't exist, but we'll try to create account
      vendorProfile = { id: profile.id, payout_account_id: null, stripe_onboard_status: 'not_started' }
    } else {
      vendorProfile = newVendorProfile
    }
  } else {
    vendorProfile = existingVendorProfile
  }

  let accountId: string

  // Check if Connect account already exists
  if (vendorProfile.payout_account_id) {
    accountId = vendorProfile.payout_account_id

    // Verify account still exists in Stripe
    try {
      await stripe.accounts.retrieve(accountId)
    } catch (stripeError) {
      logger.warn('Stripe account not found, creating new one', stripeError, { accountId })
      // Account doesn't exist, create new one
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, can be made configurable
        email: profile.email || undefined,
        metadata: {
          vendor_id: profile.id,
          id: userId,
        },
      })
      accountId = account.id

      // Update vendor profile
      await adminClient
        .from('vendor_profiles')
        .update({
          payout_account_id: accountId,
          stripe_onboard_status: 'pending',
        })
        .eq('id', profile.id)
    }
  } else {
    // Create new Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // Default to US, can be made configurable
      email: profile.email || undefined,
      metadata: {
        vendor_id: profile.id,
        id: userId,
      },
    })
    accountId = account.id

    // Update vendor profile
    await adminClient
      .from('vendor_profiles')
      .update({
        payout_account_id: accountId,
        stripe_onboard_status: 'pending',
      })
      .eq('id', profile.id)
  }

  // Create account link for onboarding
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${NEXT_PUBLIC_APP_URL}/vendor/${profile.id}?connect=refresh`,
      return_url: `${NEXT_PUBLIC_APP_URL}/vendor/${profile.id}?connect=success`,
      type: 'account_onboarding',
    })

    return successResponse({
      url: accountLink.url,
      accountId: accountId,
    })
  } catch (stripeError) {
    logger.error('Failed to create account link', stripeError, { accountId, vendorId: profile.id })
    return errorResponse(
      'Failed to create onboarding link',
      'STRIPE_ERROR',
      stripeError instanceof Error ? stripeError.message : 'Unknown error',
      500
    )
  }
})

