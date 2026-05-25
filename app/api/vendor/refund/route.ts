// CLERK MIGRATION: Vendor refund API
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { strictRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  notFoundResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return internalErrorResponse('Payment system not configured')
  }

  // Authenticate user
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse('Authentication failed')
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  // Get user's profile UUID
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return unauthorizedResponse('Profile not found')
  }

  // Parse request body
  const body = await safeJsonParse<{ order_id: string; amount?: number; reason?: string }>(req)
  if (!body || !body.order_id) {
    return errorResponse('Order ID is required', 'MISSING_ORDER_ID', 400)
  }

  const { order_id, amount, reason } = body

  // Get order and verify vendor owns it
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, vendor, total, stripe_payment_intent, status')
    .eq('id', order_id)
    .maybeSingle()

  if (orderError || !order) {
    return notFoundResponse('Order not found')
  }

  if (order.vendor !== profile.id) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 403)
  }

  if (!order.stripe_payment_intent) {
    return errorResponse('Order has no payment intent', 'NO_PAYMENT_INTENT', 400)
  }

  // Get payment intent to find the charge
  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent)

  if (!paymentIntent.latest_charge || typeof paymentIntent.latest_charge !== 'string') {
    return errorResponse('Payment intent has no charge', 'NO_CHARGE', 400)
  }

  // Create refund
  const refundAmount = amount ? Math.round(amount * 100) : undefined // Convert to cents if partial

  try {
    const refund = await stripe.refunds.create({
      charge: paymentIntent.latest_charge,
      amount: refundAmount,
      reason: reason ? (reason as any) : undefined,
      metadata: {
        order_id: order_id,
        vendor_id: profile.id,
      },
    })

    // Update order status
    await adminClient
      .from('orders')
      .update({
        status: refundAmount && refundAmount < Math.round(Number(order.total) * 100) ? 'partially_refunded' : 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    // If using Stripe Connect, handle application fee refund
    if (paymentIntent.on_behalf_of) {
      // Stripe automatically handles application fee refunds proportionally
      logger.info('Refund created for Connect account', { order_id, refund_id: refund.id })
    }

    return successResponse({
      refund_id: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      order_id: order_id,
    })
  } catch (error) {
    logger.error('Error creating refund', error, { order_id })
    return internalErrorResponse('Failed to create refund', error)
  }
})

