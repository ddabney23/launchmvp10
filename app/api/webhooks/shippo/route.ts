/**
 * Shippo Webhook Handler
 * Handles tracking updates from Shippo
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { verifyShippoWebhook } from '@/lib/webhook-verify'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { webhookRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET

/**
 * POST /api/webhooks/shippo
 * Handle Shippo webhook events
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  if (!WEBHOOK_SECRET) {
    logger.error('SHIPPO_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const verified = verifyShippoWebhook(rawBody, {
    secret: WEBHOOK_SECRET,
    authorizationHeader: req.headers.get('authorization'),
    queryToken: req.nextUrl.searchParams.get('token'),
    signatureHeader:
      req.headers.get('shippo-signature') ??
      req.headers.get('x-shippo-signature') ??
      req.headers.get('Shippo-Signature'),
  })

  if (!verified) {
    logger.warn('Shippo webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return errorResponse('Invalid JSON body', 'PARSE_ERROR')
  }

  const adminClient = createAdminClient()

  try {
    const eventType = (body.event || body.event_type) as string | undefined
    const trackingNumber = body.tracking_number as string | undefined
    const transactionId = (body.transaction || body.transaction_id) as string | undefined

    logger.info('Shippo webhook received', { eventType, trackingNumber, transactionId })

    if (eventType === 'track_updated' && trackingNumber) {
      const { data: label, error: labelError } = await adminClient
        .from('shipping_labels')
        .select('id, order_id, status')
        .eq('tracking_number', trackingNumber)
        .maybeSingle()

      if (labelError) {
        logger.error('Failed to find shipping label', labelError, { trackingNumber })
      } else if (label) {
        const shippoStatus = body.status as string | undefined
        const newStatus =
          shippoStatus === 'DELIVERED'
            ? 'delivered'
            : shippoStatus === 'TRANSIT'
              ? 'shipped'
              : label.status

        await adminClient
          .from('shipping_labels')
          .update({
            status: newStatus,
            metadata: {
              ...((label.metadata as Record<string, unknown>) || {}),
              last_webhook: new Date().toISOString(),
              shippo_status: shippoStatus,
            },
          })
          .eq('id', label.id)

        if (shippoStatus === 'DELIVERED' && label.order_id) {
          await adminClient
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', label.order_id)
            .eq('status', 'shipped')
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
