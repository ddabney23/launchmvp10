import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAuthUserId } from '@/lib/supabase-auth'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const CancelOrderSchema = z.object({
  reason: z.string().min(10).max(500),
  refundAmount: z.number().positive().optional(),
})

type JsonObject = Record<string, unknown>

interface OrderRow {
  id: string
  buyer: string | null
  vendor: string | null
  status: string
  total: number | string
  stripe_payment_intent: string | null
  metadata: JsonObject | null
}

interface OrderItemRow {
  listing_id: string | null
  quantity: number
}

interface ListingQuantityRow {
  id: string
  quantity: number | null
}

type RefundState =
  | { status: 'not_applicable' }
  | { status: 'not_configured' }
  | { status: 'no_charge' }
  | { status: 'initiated'; refundId: string }
  | { status: 'failed' }

const CANCELLABLE_STATUSES = new Set(['pending', 'paid'])

function toMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

async function refundPaymentIntent(paymentIntentId: string, amount?: number): Promise<RefundState> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'not_configured' as const }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
  })

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (!paymentIntent.latest_charge || typeof paymentIntent.latest_charge !== 'string') {
    return { status: 'no_charge' as const }
  }

  const refund = await stripe.refunds.create({
    charge: paymentIntent.latest_charge,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason: 'requested_by_customer',
    metadata: { payment_intent: paymentIntentId },
  })

  return { status: 'initiated' as const, refundId: refund.id }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const userId = await getAuthUserId()
    const { orderId } = await context.params
    const body = await request.json().catch(() => null)
    const validation = CancelOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { reason, refundAmount } = validation.data
    const adminClient = createAdminClient()

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile?.id) {
      logger.error('Failed to fetch canceling profile', profileError, { userId })
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: orderData, error: orderError } = await adminClient
      .from('orders')
      .select('id, buyer, vendor, status, total, stripe_payment_intent, metadata')
      .eq('id', orderId)
      .maybeSingle()

    const order = orderData as OrderRow | null
    if (orderError || !order) {
      logger.error('Order not found for cancellation', orderError, { orderId })
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isBuyer = order.buyer === profile.id
    const isVendor = order.vendor === profile.id
    if (!isBuyer && !isVendor) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this order' },
        { status: 403 }
      )
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return NextResponse.json(
        {
          error: 'Order cannot be cancelled',
          message: `Orders with status "${order.status}" cannot be cancelled`,
        },
        { status: 400 }
      )
    }

    const { data: itemData, error: itemsError } = await adminClient
      .from('order_items')
      .select('listing_id, quantity')
      .eq('order_id', orderId)

    if (itemsError) {
      logger.error('Failed to fetch order items for cancellation', itemsError, { orderId })
      return NextResponse.json({ error: 'Failed to load order items' }, { status: 500 })
    }

    const items = (itemData || []) as OrderItemRow[]
    for (const item of items) {
      if (!item.listing_id || !item.quantity) continue

      const { data: listingData, error: listingError } = await adminClient
        .from('listings')
        .select('id, quantity')
        .eq('id', item.listing_id)
        .maybeSingle()

      const listing = listingData as ListingQuantityRow | null
      if (listingError || !listing) {
        logger.warn('Failed to load listing while restoring stock', listingError, {
          orderId,
          listingId: item.listing_id,
        })
        continue
      }

      const { error: stockError } = await adminClient
        .from('listings')
        .update({
          quantity: (listing.quantity || 0) + item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.listing_id)

      if (stockError) {
        logger.warn('Failed to restore listing stock', stockError, {
          orderId,
          listingId: item.listing_id,
        })
      }
    }

    const effectiveRefundAmount = refundAmount ?? toMoney(order.total)
    let refundState: RefundState = {
      status: 'not_applicable',
    }

    if (order.stripe_payment_intent && effectiveRefundAmount > 0 && order.status === 'paid') {
      try {
        refundState = await refundPaymentIntent(order.stripe_payment_intent, refundAmount)
      } catch (refundError) {
        logger.error('Failed to initiate order cancellation refund', refundError, { orderId })
        refundState = { status: 'failed' }
      }
    }

    const now = new Date().toISOString()
    const metadata = {
      ...(order.metadata || {}),
      cancellation: {
        reason,
        canceled_by: profile.id,
        canceled_by_role: isVendor ? 'vendor' : 'buyer',
        canceled_at: now,
        refund_amount: effectiveRefundAmount,
        refund_status: refundState.status,
        ...(refundState.status === 'initiated' ? { refund_id: refundState.refundId } : {}),
      },
    }

    const { data: updatedOrder, error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'canceled',
        metadata,
        updated_at: now,
      })
      .eq('id', orderId)
      .select('id, status, metadata')
      .maybeSingle()

    if (updateError || !updatedOrder) {
      logger.error('Failed to cancel order', updateError, { orderId })
      return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 })
    }

    const notifications = [
      order.buyer && order.buyer !== profile.id
        ? {
            user_id: order.buyer,
            type: 'order_canceled',
            data: { orderId, reason, canceledBy: isVendor ? 'vendor' : 'buyer' },
          }
        : null,
      order.vendor && order.vendor !== profile.id
        ? {
            user_id: order.vendor,
            type: 'order_canceled',
            data: { orderId, reason, canceledBy: isBuyer ? 'buyer' : 'vendor' },
          }
        : null,
    ].filter((notification): notification is NonNullable<typeof notification> => Boolean(notification))

    if (notifications.length > 0) {
      const { error: notificationError } = await adminClient
        .from('notifications')
        .insert(notifications)

      if (notificationError) {
        logger.warn('Failed to send order cancellation notifications', notificationError, { orderId })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order canceled successfully',
      order: updatedOrder,
      refundStatus: refundState.status,
    })
  } catch (error) {
    logger.error('Order cancellation error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
