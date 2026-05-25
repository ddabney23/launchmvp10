/**
 * Shipping Rates API
 * Get shipping rates from Shippo
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

const ShippingRatesSchema = z.object({
  order_id: z.string().uuid(),
  from_address: z.object({
    name: z.string(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  to_address: z.object({
    name: z.string(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('US'),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),
  parcel: z.object({
    length: z.string(),
    width: z.string(),
    height: z.string(),
    distance_unit: z.enum(['in', 'cm']).default('in'),
    weight: z.string(),
    mass_unit: z.enum(['lb', 'kg', 'oz', 'g']).default('lb'),
  }),
  carrier_accounts: z.array(z.string()).optional(), // Optional: specific carrier accounts
})

/**
 * POST /api/shipping/rates
 * Get shipping rates for an order
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

  const { order_id, from_address, to_address, parcel, carrier_accounts } = validateRequest(ShippingRatesSchema, body)

  // Verify order exists and user has access (vendor or buyer)
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, vendor, buyer')
    .eq('id', order_id)
    .maybeSingle()

  if (orderError || !order) {
    logger.error('Failed to fetch order', orderError, { orderId: order_id })
    return errorResponse('Order not found', 'ORDER_NOT_FOUND', null, 404)
  }

  if (order.vendor !== profile.id && order.buyer !== profile.id) {
    return errorResponse('Unauthorized access to order', 'UNAUTHORIZED', null, 403)
  }

  try {
    // Create shipment in Shippo
    const shipment = await shippoClient.shipment.create({
      address_from: from_address,
      address_to: to_address,
      parcels: [parcel],
      carrier_accounts: carrier_accounts,
      async: false, // Synchronous request
    })

    if (!shipment.rates || shipment.rates.length === 0) {
      return errorResponse('No shipping rates available', 'NO_RATES', null, 400)
    }

    // Format rates for response
    const rates = shipment.rates.map((rate: any) => ({
      object_id: rate.object_id,
      provider: rate.provider,
      servicelevel: rate.servicelevel,
      amount: rate.amount,
      currency: rate.currency,
      estimated_days: rate.estimated_days,
      duration_terms: rate.duration_terms,
    }))

    return successResponse({
      shipment_id: shipment.object_id,
      rates: rates,
      address_from: shipment.address_from,
      address_to: shipment.address_to,
    })
  } catch (shippoError: any) {
    logger.error('Shippo API error', shippoError, { orderId: order_id })
    return errorResponse(
      'Failed to get shipping rates',
      'SHIPPO_ERROR',
      shippoError?.message || 'Unknown Shippo error',
      500
    )
  }
})

