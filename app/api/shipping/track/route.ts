/**
 * Shipping Tracking API
 * Get tracking status from Shippo
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
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY

// Only initialize Shippo client if API key is available (allows build to succeed)
const shippoClient = SHIPPO_API_KEY ? shippo({ apiKey: SHIPPO_API_KEY }) : null

/**
 * GET /api/shipping/track
 * Get tracking status for a shipment
 * Query params: tracking_number or order_id
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
  const orderId = searchParams.get('order_id')

  if (!trackingNumber && !orderId) {
    return errorResponse('tracking_number or order_id is required', 'MISSING_PARAM')
  }

  let trackingNum: string | null = trackingNumber

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

    // If not in order, try shipping_labels
    if (!trackingNum) {
      const { data: label } = await adminClient
        .from('shipping_labels')
        .select('tracking_number, vendor_id')
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
      }
    }
  }

  if (!trackingNum) {
    return errorResponse('Tracking number not found', 'TRACKING_NOT_FOUND', null, 404)
  }

  if (!shippoClient) {
    return errorResponse('Shippo API is not configured', 'SHIPPO_NOT_CONFIGURED', null, 503)
  }

  try {
    // Get tracking status from Shippo
    const tracking = await shippoClient.track.get_status(trackingNum)

    return successResponse({
      tracking_number: trackingNum,
      status: tracking.status,
      status_details: tracking.status_details,
      status_date: tracking.status_date,
      location: tracking.location,
      carrier: tracking.carrier,
      tracking_history: tracking.tracking_history || [],
    })
  } catch (shippoError: any) {
    logger.error('Shippo tracking API error', shippoError, { trackingNumber: trackingNum })
    return errorResponse(
      'Failed to get tracking status',
      'SHIPPO_ERROR',
      shippoError?.message || 'Unknown Shippo error',
      500
    )
  }
})

