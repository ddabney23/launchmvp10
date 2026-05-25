// CLERK MIGRATION: Updated to use Clerk authentication
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClientFromRequest, createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { PaymentIntentCreateSchema } from '@/lib/validations/schemas'
import { logger } from '@/lib/logger'
import { strictRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Extended schema with orderId field
const PaymentIntentSchema = PaymentIntentCreateSchema.extend({
  orderId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  // Check if Stripe is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return internalErrorResponse('Payment system not configured')
  }

  // CLERK MIGRATION: Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in payment intent', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Strict rate limit for payment operations (10/min)
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = createClientFromRequest(req.headers.get('Authorization'))

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const { amount, orderId, currency, customerId } = validateRequest(PaymentIntentSchema, body)

  // Get user's profile UUID (userId is Clerk ID, orders.buyer is profile UUID)
  const adminClient = createAdminClient()
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile in payment intent', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  // Verify order exists and user owns it
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, total, status, buyer, vendor')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) {
    logger.error('Failed to fetch order', orderError, { orderId })
    return internalErrorResponse('Failed to fetch order', orderError)
  }

  if (!order) {
    return notFoundResponse('Order not found')
  }

  // Verify user owns the order (compare profile UUIDs, not Clerk IDs)
  if (order.buyer !== profile.id) {
    return forbiddenResponse('You can only create payment intents for your own orders')
  }

  // Verify order amount matches
  if (Math.abs(Number(order.total) - amount) > 0.01) {
    return errorResponse('Amount mismatch', 'AMOUNT_MISMATCH', {
      orderAmount: order.total,
      requestedAmount: amount,
    })
  }

  // Get vendor's Connect account and subscription tier
  let connectAccountId: string | null = null
  let applicationFeeAmount: number | undefined = undefined

  if (order.vendor) {
    // Get vendor profile with Connect account
    const { data: vendorProfile } = await adminClient
      .from('vendor_profiles')
      .select('payout_account_id, transaction_fee_percent')
      .eq('id', order.vendor)
      .maybeSingle()

    if (vendorProfile?.payout_account_id) {
      connectAccountId = vendorProfile.payout_account_id

      // Calculate application fee based on vendor's transaction fee
      const feePercent = Number(vendorProfile.transaction_fee_percent) || 2.0
      const feeAmount = (amount * feePercent) / 100
      applicationFeeAmount = Math.round(feeAmount * 100) // Convert to cents

      // Minimum application fee: $0.50 (50 cents)
      if (applicationFeeAmount < 50) {
        applicationFeeAmount = 50
      }
    }
  }

  // Create payment intent with Stripe Connect if vendor has Connect account
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency.toLowerCase(),
    metadata: { 
      orderId,
      customerId: customerId || profile.id || '',
      ...(connectAccountId && { vendor_account_id: connectAccountId }),
    },
    automatic_payment_methods: { enabled: true },
    description: `Order #${orderId.substring(0, 8)}`,
  }

  // Add Stripe Connect parameters if vendor has Connect account
  if (connectAccountId && applicationFeeAmount) {
    paymentIntentParams.on_behalf_of = connectAccountId
    paymentIntentParams.application_fee_amount = applicationFeeAmount
    paymentIntentParams.transfer_data = {
      destination: connectAccountId,
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

  // Update order with payment intent ID (use admin client for update)
  const { error: updateError } = await adminClient
    .from('orders')
    .update({ 
      stripe_payment_intent: paymentIntent.id,
      status: 'pending'
    })
    .eq('id', orderId)

  if (updateError) {
    logger.error('Failed to update order with payment intent', updateError, {
      orderId,
      paymentIntentId: paymentIntent.id,
    })
    // Don't fail the request - payment intent was created successfully
  }

  return successResponse({
    clientSecret: paymentIntent.client_secret,
    stripe_payment_intent: paymentIntent.id,
  })
})

