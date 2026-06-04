/**
 * Shippo Webhook Handler
 * Handles tracking updates from Shippo
 */

import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { webhookRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type ShippoWebhookPayload = {
  event?: string
  event_type?: string
  tracking_number?: string
  transaction?: string
  transaction_id?: string
  status?: string
}

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer)
}

function verifyShippoSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.SHIPPO_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return false

  const timestampMatch = signatureHeader.match(/(?:^|,)t=([^,]+)/)
  const v1Match = signatureHeader.match(/(?:^|,)v1=([a-f0-9]+)/i)

  if (timestampMatch?.[1] && v1Match?.[1]) {
    const signedPayload = `${timestampMatch[1]}.${rawBody}`
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
    return safeCompare(v1Match[1], expected)
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return /^[a-f0-9]+$/i.test(signatureHeader) && safeCompare(signatureHeader, expected)
}

/**
 * POST /api/webhooks/shippo
 * Handle Shippo webhook events
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  // Rate limit check
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  try {
    const rawBody = await req.text()
    const signature =
      req.headers.get('shippo-auth-signature') ||
      req.headers.get('x-shippo-signature')

    if (!verifyShippoSignature(rawBody, signature)) {
      logger.warn('Rejected Shippo webhook with invalid signature')
      return errorResponse('Invalid webhook signature', 'INVALID_SIGNATURE', undefined, 401)
    }

    const body = JSON.parse(rawBody) as ShippoWebhookPayload

    // Shippo webhook events
    const eventType = body.event || body.event_type
    const trackingNumber = body.tracking_number
    const transactionId = body.transaction || body.transaction_id

    logger.info('Shippo webhook received', { eventType, trackingNumber, transactionId })

    if (eventType === 'track_updated' && trackingNumber) {
      // Update shipping label status
      const { data: label, error: labelError } = await adminClient
        .from('shipping_labels')
        .select('id, order_id, status')
        .eq('tracking_number', trackingNumber)
        .maybeSingle()

      if (labelError) {
        logger.error('Failed to find shipping label', labelError, { trackingNumber })
      } else if (label) {
        // Determine status from Shippo event
        const newStatus = body.status === 'DELIVERED' ? 'delivered' : 
                         body.status === 'TRANSIT' ? 'shipped' : 
                         label.status

        // Update shipping label
        await adminClient
          .from('shipping_labels')
          .update({
            status: newStatus,
            metadata: {
              ...((label.metadata as Record<string, unknown>) || {}),
              last_webhook: new Date().toISOString(),
              shippo_status: body.status,
            },
          })
          .eq('id', label.id)

        // Update order status if delivered
        if (body.status === 'DELIVERED' && label.order_id) {
          await adminClient
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', label.order_id)
            .eq('status', 'shipped') // Only update if currently shipped
        }

        logger.info('Shipping label updated from webhook', { labelId: label.id, newStatus })
      }
    }

    return successResponse({ received: true })
  } catch (error) {
    logger.error('Shippo webhook processing error', error)
    return internalErrorResponse('Failed to process webhook', error)
  }
})

