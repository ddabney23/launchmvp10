/**
 * Subscription Checkout API
 * Creates Stripe Checkout Session for subscription
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
  safeJsonParse,
  validateRequest,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers'

export const dynamic = 'force-dynamic'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
})

const CheckoutSchema = z.object({
  tier: z.enum(['basic', 'pro', 'premium']), // Free tier doesn't need checkout
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
})

/**
 * POST /api/vendor/subscriptions/checkout
 * Create Stripe Checkout Session for subscription
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
    .select('id, is_vendor, email')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  if (!profile.is_vendor) {
    return errorResponse('User is not a vendor', 'NOT_VENDOR', null, 403)
  }

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR')
  }

  const { tier, success_url, cancel_url } = validateRequest(CheckoutSchema, body)
  const tierConfig = SUBSCRIPTION_TIERS[tier]

  // Get or create Stripe customer
  const { data: subscription } = await adminClient
    .from('vendor_subscriptions')
    .select('stripe_customer_id')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  let customerId: string
  if (subscription?.stripe_customer_id) {
    customerId = subscription.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email: profile.email || undefined,
      metadata: {
        vendor_id: profile.id,
        id: userId,
      },
    })
    customerId = customer.id
  }

  // Create Checkout Session
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: success_url || `${NEXT_PUBLIC_APP_URL}/vendor/${profile.id}?subscription=success`,
      cancel_url: cancel_url || `${NEXT_PUBLIC_APP_URL}/vendor/${profile.id}?subscription=canceled`,
      metadata: {
        vendor_id: profile.id,
        tier: tier,
      },
      subscription_data: {
        metadata: {
          vendor_id: profile.id,
          tier: tier,
        },
      },
    })

    return successResponse({
      sessionId: session.id,
      url: session.url,
    })
  } catch (stripeError) {
    logger.error('Stripe checkout session creation failed', stripeError, { vendorId: profile.id, tier })
    return errorResponse(
      'Failed to create checkout session',
      'STRIPE_ERROR',
      stripeError instanceof Error ? stripeError.message : 'Unknown error',
      500
    )
  }
})

