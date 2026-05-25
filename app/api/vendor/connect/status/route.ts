/**
 * Stripe Connect Status API
 * Get Connect account status and onboarding information
 */

import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getAuthUserId } from '@/lib/supabase-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
})

/**
 * GET /api/vendor/connect/status
 * Get Connect account status
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse('Authentication required')
  }

  const adminClient = createAdminClient()

  // Get vendor's profile UUID
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_vendor')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  if (!profile.is_vendor) {
    return errorResponse('User is not a vendor', 'NOT_VENDOR', null, 403)
  }

  // Get vendor profile
  const { data: vendorProfile, error: vendorError } = await adminClient
    .from('vendor_profiles')
    .select('payout_account_id, stripe_onboard_status, payout_balance')
    .eq('id', profile.id)
    .maybeSingle()

  if (vendorError || !vendorProfile) {
    logger.error('Failed to fetch vendor profile', vendorError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch vendor profile', vendorError)
  }

  if (!vendorProfile.payout_account_id) {
    return successResponse({
      connected: false,
      onboardStatus: 'not_started',
      payoutBalance: Number(vendorProfile.payout_balance) || 0,
      accountId: null,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
  }

  // Get account details from Stripe
  try {
    const account = await stripe.accounts.retrieve(vendorProfile.payout_account_id)

    return successResponse({
      connected: true,
      onboardStatus: vendorProfile.stripe_onboard_status || 'pending',
      payoutBalance: Number(vendorProfile.payout_balance) || 0,
      accountId: account.id,
      detailsSubmitted: account.details_submitted || false,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      email: account.email,
      country: account.country,
    })
  } catch (stripeError) {
    logger.error('Failed to retrieve Stripe account', stripeError, { accountId: vendorProfile.payout_account_id })
    return errorResponse(
      'Failed to retrieve account status',
      'STRIPE_ERROR',
      stripeError instanceof Error ? stripeError.message : 'Unknown error',
      500
    )
  }
})

