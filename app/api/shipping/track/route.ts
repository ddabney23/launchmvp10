/**
 * Shipping Tracking API
 * Get tracking status from Shippo
 */

import { NextRequest } from 'next/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { getShippoClient } from '@/lib/shippo'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/shipping/track
 * Get tracking status for a shipment.
 * Query params: tracking_number + carrier, or order_id for stored shipments.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse('Authentication required')
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

  const { searchParams } = new URL(req.url)
  const trackingNumber = searchParams.get('tracking_number')
  const carrier = searchParams.get('carrier')
  const orderId = searchParams.get('order_id')

  if (!trackingNumber && !orderId) {
    return errorResponse('tracking_number or order_id is required', 'MISSING_PARAM')
  }

  let trackingNum: string | null = trackingNumber
  let trackingCarrier: string | null = carrier

  // If order_id provided, get tracking number from order or shipping label
  if (orderId && !trackingNum) {
    // Try to get from order
    const { data: order } = await adminClient
      .from('orders')
      .select('tracking_number, vendor, buyer')
      .eq('id', orderId)
      .maybeSingle()

    if (order) {
      // Verify user has access (vendor or buyer)
      if (order.vendor !== profile.id && order.buyer !== profile.id) {
        return errorResponse('Unauthorized access to order', 'UNAUTHORIZED', null, 403)
      }
      trackingNum = order.tracking_number
    }

    // Always try shipping_labels for carrier, and for tracking number fallback.
    if (!trackingCarrier || !trackingNum) {
      const { data: label } = await adminClient
        .from('shipping_labels')
        .select('tracking_number, vendor_id, carrier')
        .eq('order_id', orderId)
        .maybeSingle()

      if (label) {
        // Verify user has access
        if (label.vendor_id !== profile.id) {
          // Check if user is buyer
          const { data: orderCheck } = await adminClient
            .from('orders')
            .select('buyer')
            .eq('id', orderId)
            .maybeSingle()

          if (orderCheck?.buyer !== profile.id) {
            return errorResponse('Unauthorized access to order', 'UNAUTHORIZED', null, 403)
          }
        }
        trackingNum = label.tracking_number
        trackingCarrier = label.carrier
      }
    }
  }

  if (!trackingNum) {
    return errorResponse('Tracking number not found', 'TRACKING_NOT_FOUND', null, 404)
  }

  if (!trackingCarrier) {
    return errorResponse('carrier is required for tracking lookups', 'MISSING_CARRIER', null, 400)
  }

  const shippoClient = getShippoClient()
  if (!shippoClient) {
    return errorResponse('Shippo API is not configured', 'SHIPPO_NOT_CONFIGURED', null, 503)
  }

  try {
    // Get tracking status from Shippo
    const tracking = await shippoClient.trackingStatus.get(trackingNum, trackingCarrier)

    return successResponse({
      tracking_number: trackingNum,
      carrier: tracking.carrier,
      status: tracking.trackingStatus?.status,
      status_details: tracking.trackingStatus?.statusDetails,
      status_date: tracking.trackingStatus?.statusDate,
      location: tracking.trackingStatus?.location,
      tracking_history: tracking.trackingHistory || [],
    })
  } catch (shippoError: unknown) {
    logger.error('Shippo tracking API error', shippoError, { trackingNumber: trackingNum })
    const message = shippoError instanceof Error ? shippoError.message : 'Unknown Shippo error'
    return errorResponse(
      'Failed to get tracking status',
      'SHIPPO_ERROR',
      message,
      500
    )
  }
})

