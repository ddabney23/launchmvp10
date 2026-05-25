/**
 * Subscription Portal API
 * Creates Stripe Customer Portal session for subscription management
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
  notFoundResponse,
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
 * POST /api/vendor/subscriptions/portal
 * Create Stripe Customer Portal session
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

  // Get subscription with Stripe customer ID
  const { data: subscription, error: subError } = await adminClient
    .from('vendor_subscriptions')
    .select('stripe_customer_id')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  if (subError) {
    logger.error('Failed to fetch subscription', subError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch subscription', subError)
  }

  if (!subscription?.stripe_customer_id) {
    return notFoundResponse('No active paid subscription found')
  }

  // Create Customer Portal session
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${NEXT_PUBLIC_APP_URL}/vendor/${profile.id}`,
    })

    return successResponse({
      url: session.url,
    })
  } catch (stripeError) {
    logger.error('Stripe portal session creation failed', stripeError, { vendorId: profile.id })
    return errorResponse(
      'Failed to create portal session',
      'STRIPE_ERROR',
      stripeError instanceof Error ? stripeError.message : 'Unknown error',
      500
    )
  }
})

