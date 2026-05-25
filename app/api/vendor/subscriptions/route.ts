/**
 * Vendor Subscriptions API
 * Handles subscription creation, updates, and retrieval
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
  notFoundResponse,
  internalErrorResponse,
  withErrorHandling,
  safeJsonParse,
  validateRequest,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscription-tiers'

export const dynamic = 'force-dynamic'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is missing from environment variables')
  throw new Error('STRIPE_SECRET_KEY is required. Please add it to your .env.local file.')
}

// Initialize Stripe with error handling
let stripe: Stripe
try {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
  })
} catch (stripeError) {
  console.error('Failed to initialize Stripe client:', stripeError)
  throw new Error('Failed to initialize Stripe. Please check your STRIPE_SECRET_KEY.')
}

// Schema for creating/updating subscription
const CreateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'basic', 'pro', 'premium']),
})

const UpdateSubscriptionSchema = z.object({
  tier: z.enum(['free', 'basic', 'pro', 'premium']).optional(),
  cancel_at_period_end: z.boolean().optional(),
})

/**
 * GET /api/vendor/subscriptions
 * Get vendor's current subscription
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

  // Get subscription
  const { data: subscription, error: subError } = await adminClient
    .from('vendor_subscriptions')
    .select('*')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  if (subError) {
    logger.error('Failed to fetch subscription', subError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch subscription', subError)
  }

  // If no subscription exists, create a free one
  if (!subscription) {
    const { data: newSubscription, error: createError } = await adminClient
      .from('vendor_subscriptions')
      .insert({
        vendor_id: profile.id,
        tier: 'free',
        status: 'active',
      })
      .select()
      .single()

    if (createError) {
      logger.error('Failed to create default subscription', createError, { vendorId: profile.id })
      return internalErrorResponse('Failed to create subscription', createError)
    }

    return successResponse(newSubscription)
  }

  return successResponse(subscription)
})

/**
 * POST /api/vendor/subscriptions
 * Create or upgrade subscription
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
    .select('id, is_vendor, email')
    .eq('id', userId)
    .maybeSingle()

  // If profile doesn't exist, create it (webhook might not have fired yet)
  if (!profile) {
    logger.warn('Profile not found for subscription, creating it', { userId })
    
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
        .select('id, is_vendor, email')
        .single()

      if (createError || !newProfile) {
        logger.error('Failed to create profile during subscription', createError, { userId })
        return internalErrorResponse('Failed to create user profile', createError || new Error('Profile creation returned no data'))
      }

      profile = newProfile
      logger.info('Created profile during subscription', { userId, profileId: profile.id })
    } catch (createError) {
      logger.error('Error creating profile during subscription', createError, { userId })
      return internalErrorResponse('Failed to create user profile', createError)
    }
  } else if (profileError) {
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

  const { tier } = validateRequest(CreateSubscriptionSchema, body)
  const tierConfig = SUBSCRIPTION_TIERS[tier]

  // Get existing subscription
  const { data: existingSubscription, error: fetchError } = await adminClient
    .from('vendor_subscriptions')
    .select('*')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  if (fetchError) {
    logger.error('Failed to fetch existing subscription', fetchError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch subscription', fetchError)
  }

  // If free tier, create subscription without Stripe
  if (tier === 'free') {
    if (existingSubscription) {
      // Update to free tier
      const { data: updated, error: updateError } = await adminClient
        .from('vendor_subscriptions')
        .update({
          tier: 'free',
          status: 'active',
          stripe_subscription_id: null,
          stripe_customer_id: null,
          stripe_price_id: null,
          cancel_at_period_end: false,
        })
        .eq('vendor_id', profile.id)
        .select()
        .single()

      if (updateError) {
        logger.error('Failed to update subscription to free', updateError, { vendorId: profile.id })
        return internalErrorResponse('Failed to update subscription', updateError)
      }

      return successResponse(updated, 'Subscription updated to free tier')
    } else {
      // Create free subscription
      const { data: newSubscription, error: createError } = await adminClient
        .from('vendor_subscriptions')
        .insert({
          vendor_id: profile.id,
          tier: 'free',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
          cancel_at_period_end: false,
        })
        .select()
        .single()

      if (createError) {
        logger.error('Failed to create free subscription', createError, { vendorId: profile.id })
        return internalErrorResponse('Failed to create subscription', createError)
      }

      return successResponse(newSubscription, 'Free subscription created')
    }
  }

  // For paid tiers, create Stripe subscription
  try {
    // Validate Stripe is initialized
    if (!stripe) {
      logger.error('Stripe client not initialized', undefined, { vendorId: profile.id })
      return errorResponse('Stripe is not configured', 'STRIPE_NOT_CONFIGURED', 'Please configure STRIPE_SECRET_KEY in environment variables', 500)
    }

    // Get or create Stripe customer
    let customerId: string
    if (existingSubscription?.stripe_customer_id) {
      customerId = existingSubscription.stripe_customer_id
      // Verify customer still exists in Stripe
      try {
        await stripe.customers.retrieve(customerId)
      } catch (stripeError) {
        logger.warn('Stripe customer not found, creating new one', stripeError, { customerId })
        const customer = await stripe.customers.create({
          email: profile.email || undefined,
          metadata: {
            vendor_id: profile.id,
            id: userId,
          },
        })
        customerId = customer.id
      }
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

    // Create or update subscription
    if (existingSubscription?.stripe_subscription_id) {
      // First, retrieve the subscription to get the current item ID
      const currentSubscription = await stripe.subscriptions.retrieve(
        existingSubscription.stripe_subscription_id
      )
      
      // Get the subscription item ID (first item)
      const subscriptionItemId = currentSubscription.items.data[0]?.id
      
      if (!subscriptionItemId) {
        logger.error('No subscription item found', undefined, { subscriptionId: existingSubscription.stripe_subscription_id })
        return errorResponse('Invalid subscription', 'INVALID_SUBSCRIPTION', 'Subscription has no items', 400)
      }

      // Update existing subscription
      const subscription = await stripe.subscriptions.update(
        existingSubscription.stripe_subscription_id,
        {
          items: [{
            id: subscriptionItemId,
            price: tierConfig.priceId,
          }],
          metadata: {
            vendor_id: profile.id,
            tier: tier,
          },
        }
      )

      // Update database
      const { data: updated, error: updateError } = await adminClient
        .from('vendor_subscriptions')
        .update({
          tier: tier,
          stripe_price_id: tierConfig.priceId,
          status: subscription.status as any,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq('vendor_id', profile.id)
        .select()
        .single()

      if (updateError) {
        logger.error('Failed to update subscription in database', updateError, { vendorId: profile.id })
        return internalErrorResponse('Failed to update subscription', updateError)
      }

      return successResponse(updated, 'Subscription updated')
    } else {
      // Create new subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: tierConfig.priceId,
        }],
        metadata: {
          vendor_id: profile.id,
          tier: tier,
        },
      })

      // Insert into database
      const { data: newSubscription, error: insertError } = await adminClient
        .from('vendor_subscriptions')
        .insert({
          vendor_id: profile.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          stripe_price_id: tierConfig.priceId,
          tier: tier,
          status: subscription.status as any,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .select()
        .single()

      if (insertError) {
        logger.error('Failed to insert subscription', insertError, { vendorId: profile.id })
        // Try to cancel Stripe subscription if database insert fails
        try {
          await stripe.subscriptions.cancel(subscription.id)
        } catch (cancelError) {
          logger.error('Failed to cancel Stripe subscription after DB insert failure', cancelError)
        }
        return internalErrorResponse('Failed to create subscription', insertError)
      }

      return successResponse(newSubscription, 'Subscription created')
    }
  } catch (stripeError) {
    logger.error('Stripe error in subscription creation', stripeError, { vendorId: profile.id, tier })
    return errorResponse(
      'Failed to process subscription',
      'STRIPE_ERROR',
      stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error',
      500
    )
  }
})

/**
 * PATCH /api/vendor/subscriptions
 * Update subscription (downgrade, cancel, etc.)
 */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
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

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR')
  }

  const { tier, cancel_at_period_end } = validateRequest(UpdateSubscriptionSchema, body)

  // Get existing subscription
  const { data: subscription, error: fetchError } = await adminClient
    .from('vendor_subscriptions')
    .select('*')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  if (fetchError) {
    logger.error('Failed to fetch subscription', fetchError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch subscription', fetchError)
  }

  if (!subscription) {
    return notFoundResponse('Subscription not found')
  }

  // If updating to free tier, cancel Stripe subscription
  if (tier === 'free' && subscription.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (stripeError) {
      logger.error('Failed to cancel Stripe subscription', stripeError, { subscriptionId: subscription.stripe_subscription_id })
    }

    const { data: updated, error: updateError } = await adminClient
      .from('vendor_subscriptions')
      .update({
        tier: 'free',
        status: 'active',
        stripe_subscription_id: null,
        stripe_customer_id: null,
        stripe_price_id: null,
        cancel_at_period_end: false,
      })
      .eq('vendor_id', profile.id)
      .select()
      .single()

    if (updateError) {
      logger.error('Failed to update subscription', updateError, { vendorId: profile.id })
      return internalErrorResponse('Failed to update subscription', updateError)
    }

    return successResponse(updated, 'Subscription downgraded to free')
  }

  // Update cancel_at_period_end
  if (cancel_at_period_end !== undefined && subscription.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: cancel_at_period_end,
      })

      const { data: updated, error: updateError } = await adminClient
        .from('vendor_subscriptions')
        .update({
          cancel_at_period_end: cancel_at_period_end,
        })
        .eq('vendor_id', profile.id)
        .select()
        .single()

      if (updateError) {
        logger.error('Failed to update subscription', updateError, { vendorId: profile.id })
        return internalErrorResponse('Failed to update subscription', updateError)
      }

      return successResponse(updated, cancel_at_period_end ? 'Subscription will cancel at period end' : 'Subscription cancellation canceled')
    } catch (stripeError) {
      logger.error('Stripe error updating subscription', stripeError, { subscriptionId: subscription.stripe_subscription_id })
      return errorResponse('Failed to update subscription', 'STRIPE_ERROR', stripeError instanceof Error ? stripeError.message : 'Unknown error', 500)
    }
  }

  return errorResponse('No valid update provided', 'INVALID_UPDATE')
})

/**
 * DELETE /api/vendor/subscriptions
 * Cancel subscription immediately
 */
export const DELETE = withErrorHandling(async (req: NextRequest) => {
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

  // Get existing subscription
  const { data: subscription, error: fetchError } = await adminClient
    .from('vendor_subscriptions')
    .select('*')
    .eq('vendor_id', profile.id)
    .maybeSingle()

  if (fetchError) {
    logger.error('Failed to fetch subscription', fetchError, { vendorId: profile.id })
    return internalErrorResponse('Failed to fetch subscription', fetchError)
  }

  if (!subscription) {
    return notFoundResponse('Subscription not found')
  }

  // Cancel Stripe subscription if exists
  if (subscription.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (stripeError) {
      logger.error('Failed to cancel Stripe subscription', stripeError, { subscriptionId: subscription.stripe_subscription_id })
      // Continue with database update even if Stripe cancel fails
    }
  }

  // Update to free tier
  const { data: updated, error: updateError } = await adminClient
    .from('vendor_subscriptions')
    .update({
      tier: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_customer_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
    })
    .eq('vendor_id', profile.id)
    .select()
    .single()

  if (updateError) {
    logger.error('Failed to update subscription', updateError, { vendorId: profile.id })
    return internalErrorResponse('Failed to cancel subscription', updateError)
  }

  return successResponse(updated, 'Subscription canceled')
})

