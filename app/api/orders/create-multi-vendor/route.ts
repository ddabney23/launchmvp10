// CLERK MIGRATION: Multi-vendor order creation API
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
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'
import Stripe from 'stripe'
import { calculateApplicationFee } from '@/lib/subscription-utils'
import { getStripeSecretKey, stripeConfigErrorMessage } from '@/lib/stripe-config'

export const dynamic = 'force-dynamic'

function getStripeClient(): Stripe | null {
  const key = getStripeSecretKey()
  if (!key) return null
  return new Stripe(key, { apiVersion: '2025-10-29.clover' })
}

interface OrderItem {
  listing_id: string
  quantity: number
}

interface ShippingInfo {
  firstName: string
  lastName: string
  email: string
  address: string
  city: string
  state: string
  zipCode: string
  country: string
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const stripe = getStripeClient()
  if (!stripe) {
    return internalErrorResponse(stripeConfigErrorMessage())
  }

  // Authenticate user
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    logger.error('Authentication error in multi-vendor order creation', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Strict rate limit for payment operations
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  // Get user's profile UUID
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile in multi-vendor order', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  // Parse request body
  const body = await safeJsonParse<{ items: OrderItem[]; shipping_info: ShippingInfo }>(req)
  if (!body || !body.items || !body.shipping_info) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Items and shipping_info are required')
  }

  const { items, shipping_info } = body

  // Group items by vendor
  const vendorGroups: Record<string, OrderItem[]> = {}
  
  for (const item of items) {
    // Get listing to find vendor
    const { data: listing, error: listingError } = await adminClient
      .from('listings')
      .select('id, vendor, price, stock, quantity, title')
      .eq('id', item.listing_id)
      .maybeSingle()

    if (listingError || !listing) {
      logger.error('Listing not found', listingError, { listingId: item.listing_id })
      return errorResponse(`Listing ${item.listing_id} not found`, 'LISTING_NOT_FOUND', 404)
    }

    if (!listing.vendor) {
      return errorResponse(`Listing ${item.listing_id} has no vendor`, 'INVALID_LISTING', 400)
    }

    const availableStock =
      typeof listing.stock === 'number'
        ? listing.stock
        : typeof listing.quantity === 'number'
          ? listing.quantity
          : 0

    if (availableStock < item.quantity) {
      return errorResponse(`Insufficient stock for ${listing.title}`, 'INSUFFICIENT_STOCK', 400)
    }

    // Group by vendor
    if (!vendorGroups[listing.vendor]) {
      vendorGroups[listing.vendor] = []
    }
    vendorGroups[listing.vendor].push(item)
  }

  // Create orders for each vendor
  const orderResults = []
  
  for (const [vendorId, vendorItems] of Object.entries(vendorGroups)) {
    try {
      // Calculate vendor total
      let vendorTotal = 0
      const orderItemsData = []

      for (const item of vendorItems) {
        const { data: listing } = await adminClient
          .from('listings')
          .select('price')
          .eq('id', item.listing_id)
          .single()

        if (listing) {
          const itemTotal = Number(listing.price) * item.quantity
          vendorTotal += itemTotal
          orderItemsData.push({
            listing_id: item.listing_id,
            price: listing.price,
            quantity: item.quantity,
          })
        }
      }

      // Create order for this vendor
      const { data: order, error: orderError } = await adminClient
        .from('orders')
        .insert({
          buyer: profile.id,
          vendor: vendorId,
          status: 'pending',
          total: vendorTotal.toFixed(2),
          currency: 'USD',
          metadata: {
            shipping_info,
            is_multi_vendor: Object.keys(vendorGroups).length > 1,
          },
        })
        .select()
        .single()

      if (orderError || !order) {
        logger.error('Failed to create order', orderError, { vendorId })
        throw new Error(`Failed to create order for vendor ${vendorId}`)
      }

      // Create order items
      const { error: orderItemsError } = await adminClient
        .from('order_items')
        .insert(
          orderItemsData.map(item => ({
            order_id: order.id,
            listing_id: item.listing_id,
            price: item.price,
            quantity: item.quantity,
          }))
        )

      if (orderItemsError) {
        logger.error('Failed to create order items', orderItemsError, { orderId: order.id })
        throw new Error('Failed to create order items')
      }

      // Get vendor's Stripe Connect account if available
      const { data: vendorProfile } = await adminClient
        .from('vendor_profiles')
        .select('payout_account_id, stripe_connect_account_id')
        .eq('id', vendorId)
        .maybeSingle()

      const connectAccountId =
        vendorProfile?.payout_account_id || vendorProfile?.stripe_connect_account_id

      // Calculate application fee
      let applicationFeeAmount = 0
      if (connectAccountId) {
        try {
          applicationFeeAmount = await calculateApplicationFee(vendorId, vendorTotal)
        } catch (error) {
          logger.warn('Failed to calculate application fee', error, { vendorId })
          // Use default 5% if calculation fails
          applicationFeeAmount = Math.round(vendorTotal * 0.05 * 100) / 100
        }
      }

      // Create payment intent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(vendorTotal * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: order.id,
          customerId: profile.id,
          vendorId,
          ...(connectAccountId && { vendor_account_id: connectAccountId }),
        },
        automatic_payment_methods: { enabled: true },
        description: `Order #${order.id.substring(0, 8)}`,
      }

      // Add Stripe Connect parameters if vendor has Connect account
      if (connectAccountId && applicationFeeAmount > 0) {
        paymentIntentParams.on_behalf_of = connectAccountId
        paymentIntentParams.application_fee_amount = Math.round(applicationFeeAmount * 100)
        paymentIntentParams.transfer_data = {
          destination: connectAccountId,
        }
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

      // Update order with payment intent ID
      await adminClient
        .from('orders')
        .update({ stripe_payment_intent: paymentIntent.id })
        .eq('id', order.id)

      orderResults.push({
        order_id: order.id,
        vendor_id: vendorId,
        client_secret: paymentIntent.client_secret,
        stripe_payment_intent: paymentIntent.id,
        amount: vendorTotal,
      })
    } catch (error) {
      logger.error('Error creating order for vendor', error, { vendorId })
      // Continue with other vendors, but log the error
      // In production, you might want to rollback all orders if one fails
    }
  }

  if (orderResults.length === 0) {
    return internalErrorResponse('Failed to create any orders')
  }

  return successResponse({
    orders: orderResults,
    is_multi_vendor: Object.keys(vendorGroups).length > 1,
    total_amount: orderResults.reduce((sum, o) => sum + o.amount, 0),
  })
})

