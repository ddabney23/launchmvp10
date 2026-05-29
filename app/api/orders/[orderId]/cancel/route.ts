import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase-auth';
import { createAdminClient } from '@/integrations/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const CancelOrderSchema = z.object({
  reason: z.string().min(10).max(500),
  refundAmount: z.number().optional(),
});

/**
 * POST /api/orders/[orderId]/cancel
 * Cancel an order and restore listing stock from order_items
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const adminClient = createAdminClient();
    const { orderId } = await context.params;

    const body = await request.json();
    const validation = CancelOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { reason, refundAmount } = validation.data;

    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        *,
        order_items(
          id,
          listing_id,
          quantity,
          listing:listings(id, title, quantity, stock)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      logger.error('Order not found:', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isBuyer = order.buyer === userId;
    const isVendor = order.vendor === userId;

    if (!isBuyer && !isVendor) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this order' },
        { status: 403 }
      );
    }

    const cancellableStatuses = ['pending', 'paid'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: 'Order cannot be cancelled',
          message: `Orders with status "${order.status}" cannot be cancelled`,
        },
        { status: 400 }
      );
    }

    const orderTotal = Number(order.total) || 0;
    const calculatedRefundAmount = refundAmount ?? orderTotal;

    const existingMetadata =
      typeof order.metadata === 'object' && order.metadata !== null
        ? (order.metadata as Record<string, unknown>)
        : {};

    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'canceled',
        metadata: {
          ...existingMetadata,
          cancellation_reason: reason,
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          refund_amount: calculatedRefundAmount,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error('Failed to update order:', updateError);
      return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
    }

    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of orderItems) {
      const listing = item.listing as { id: string; quantity?: number; stock?: number } | null;
      if (!listing?.id || !item.quantity) continue;

      const currentStock =
        typeof listing.stock === 'number'
          ? listing.stock
          : typeof listing.quantity === 'number'
            ? listing.quantity
            : 0;

      const updates: { stock?: number; quantity?: number } = {};
      if (typeof listing.stock === 'number') {
        updates.stock = currentStock + item.quantity;
      } else {
        updates.quantity = currentStock + item.quantity;
      }

      const { error: stockError } = await adminClient
        .from('listings')
        .update(updates)
        .eq('id', listing.id);

      if (stockError) {
        logger.warn('Failed to restore stock:', stockError, { listingId: listing.id });
      }
    }

    if (order.stripe_payment_intent && calculatedRefundAmount > 0) {
      try {
        const refundResponse = await fetch(
          new URL('/api/vendor/refund', request.url).toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              paymentIntentId: order.stripe_payment_intent,
              amount: calculatedRefundAmount,
              reason,
            }),
          }
        );

        if (!refundResponse.ok) {
          logger.error('Refund initiation failed', { orderId });
        }
      } catch (refundError) {
        logger.error('Refund error:', refundError);
      }
    }

    const notifications: Array<{
      user_id: string;
      type: string;
      data: Record<string, unknown>;
    }> = [];

    if (order.buyer && order.buyer !== userId) {
      notifications.push({
        user_id: order.buyer,
        type: 'order_cancelled',
        data: { orderId, reason, title: 'Order Cancelled' },
      });
    }

    if (order.vendor && order.vendor !== userId) {
      notifications.push({
        user_id: order.vendor,
        type: 'order_cancelled',
        data: { orderId, reason, title: 'Order Cancelled' },
      });
    }

    if (notifications.length > 0) {
      const { error: notifError } = await adminClient.from('notifications').insert(notifications);
      if (notifError) {
        logger.warn('Failed to send notifications:', notifError);
      }
    }

    logger.info('Order cancelled successfully:', { orderId, cancelledBy: userId });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: orderId,
        status: 'canceled',
        refundAmount: calculatedRefundAmount,
        refundStatus: order.stripe_payment_intent ? 'initiated' : 'not_applicable',
      },
    });
  } catch (error) {
    logger.error('Order cancellation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
