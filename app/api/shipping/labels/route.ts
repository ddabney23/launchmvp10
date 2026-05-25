/**
 * Shipping Labels API
 * Purchase shipping label from Shippo
 */

import { NextRequest } from 'next/server'
import shippo from 'shippo'
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

export const dynamic = 'force-dynamic'

const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY

// Only initialize Shippo client if API key is available (allows build to succeed)
const shippoClient = SHIPPO_API_KEY ? shippo({ apiKey: SHIPPO_API_KEY }) : null

const PurchaseLabelSchema = z.object({
  order_id: z.string().uuid(),
  rate_id: z.string(), // Shippo rate object_id
  metadata: z.record(z.any()).optional(),
})

/**
 * POST /api/shipping/labels
 * Purchase shipping label
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

  if (!shippoClient) {
    return errorResponse('Shippo API is not configured', 'SHIPPO_NOT_CONFIGURED', null, 503)
  }

  const adminClient = createAdminClient()

  // Get user's profile UUID
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR')
  }

  const { order_id, rate_id, metadata } = validateRequest(PurchaseLabelSchema, body)

  // Verify order exists and user is the vendor
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, vendor, status')
    .eq('id', order_id)
    .maybeSingle()

  if (orderError || !order) {
    logger.error('Failed to fetch order', orderError, { orderId: order_id })
    return errorResponse('Order not found', 'ORDER_NOT_FOUND', null, 404)
  }

  if (order.vendor !== profile.id) {
    return errorResponse('Only the vendor can purchase shipping labels', 'UNAUTHORIZED', null, 403)
  }

  try {
    // Purchase label using rate
    const transaction = await shippoClient.transaction.create({
      rate: rate_id,
      async: false, // Synchronous request
      metadata: metadata || {},
    })

    if (transaction.status !== 'SUCCESS') {
      logger.error('Shippo transaction failed', null, { transactionId: transaction.object_id, status: transaction.status })
      return errorResponse(
        'Failed to purchase label',
        'LABEL_PURCHASE_FAILED',
        transaction.messages || 'Transaction failed',
        400
      )
    }

    // Get tracking number and label URL
    const trackingNumber = transaction.tracking_number
    const labelUrl = transaction.label_url
    const trackingUrl = transaction.tracking_url_provider

    // Update order with shipping information
    await adminClient
      .from('orders')
      .update({
        tracking_number: trackingNumber,
        shippo_transaction_id: transaction.object_id,
        label_url: labelUrl,
        status: 'shipped', // Update order status to shipped
      })
      .eq('id', order_id)

    // Create shipping label record
    const { data: shippingLabel, error: labelError } = await adminClient
      .from('shipping_labels')
      .insert({
        order_id: order_id,
        vendor_id: profile.id,
        shippo_transaction_id: transaction.object_id,
        tracking_number: trackingNumber,
        carrier: transaction.rate?.provider || null,
        service_level: transaction.rate?.servicelevel?.name || null,
        label_url: labelUrl,
        tracking_url: trackingUrl,
        status: 'purchased',
        cost: parseFloat(transaction.rate?.amount || '0'),
        metadata: {
          transaction_id: transaction.object_id,
          rate_id: rate_id,
          ...metadata,
        },
      })
      .select()
      .single()

    if (labelError) {
      logger.error('Failed to create shipping label record', labelError, { orderId: order_id, transactionId: transaction.object_id })
      // Don't fail the request, but log the error
    }

    return successResponse({
      label: shippingLabel || null,
      transaction: {
        id: transaction.object_id,
        tracking_number: trackingNumber,
        label_url: labelUrl,
        tracking_url: trackingUrl,
        status: transaction.status,
        cost: parseFloat(transaction.rate?.amount || '0'),
      },
    }, 'Shipping label purchased successfully')
  } catch (shippoError: any) {
    logger.error('Shippo API error purchasing label', shippoError, { orderId: order_id, rateId: rate_id })
    return errorResponse(
      'Failed to purchase shipping label',
      'SHIPPO_ERROR',
      shippoError?.message || 'Unknown Shippo error',
      500
    )
  }
})

