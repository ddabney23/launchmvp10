import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabase-auth';
import { createServerClient } from '@/integrations/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const CancelOrderSchema = z.object({
  reason: z.string().min(10).max(500),
  refundAmount: z.number().optional(),
});

/**
 * POST /api/orders/[orderId]/cancel
 * Cancel an order and initiate refund
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const userId = await getAuthUserId();
    const supabase = await createServerClient();

    const { orderId } = await context.params;

    // Parse and validate request body
    const body = await request.json();
    const validation = CancelOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { reason, refundAmount } = validation.data;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile:', profileError);
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        listing:listings(id, title, vendor_id, stock_quantity),
        buyer:profiles!orders_buyer_id_fkey(id, email, username),
        vendor:profiles!orders_vendor_id_fkey(id, email, username)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      logger.error('Order not found:', orderError);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify user has permission to cancel (buyer or vendor)
    const isBuyer = order.buyer_id === profile.id;
    const isVendor = order.vendor_id === profile.id;

    if (!isBuyer && !isVendor) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this order' },
        { status: 403 }
      );
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        { 
          error: 'Order cannot be cancelled',
          message: `Orders with status "${order.status}" cannot be cancelled`
        },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const calculatedRefundAmount = refundAmount || order.total_amount;

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        cancelled_by: profile.id,
        refund_amount: calculatedRefundAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      logger.error('Failed to update order:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel order' },
        { status: 500 }
      );
    }

    // Restore stock quantity if listing exists
    if (order.listing && order.quantity) {
      const { error: stockError } = await supabase
        .from('listings')
        .update({
          stock_quantity: (order.listing.stock_quantity || 0) + order.quantity,
        })
        .eq('id', order.listing_id);

      if (stockError) {
        logger.warn('Failed to restore stock:', stockError);
      }
    }

    // Initiate refund if payment was made
    if (order.payment_intent_id && calculatedRefundAmount > 0) {
      try {
        // Call Stripe refund API
        const refundResponse = await fetch('/api/vendor/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            paymentIntentId: order.payment_intent_id,
            amount: calculatedRefundAmount,
            reason,
          }),
        });

        if (!refundResponse.ok) {
          logger.error('Refund initiation failed');
          // Don't fail the cancellation, just log it
          await supabase
            .from('orders')
            .update({ refund_status: 'failed' })
            .eq('id', orderId);
        } else {
          await supabase
            .from('orders')
            .update({ refund_status: 'initiated' })
            .eq('id', orderId);
        }
      } catch (refundError) {
        logger.error('Refund error:', refundError);
        await supabase
          .from('orders')
          .update({ refund_status: 'failed' })
          .eq('id', orderId);
      }
    }

    // Send notifications to buyer and vendor
    const notifications = [];

    // Notify buyer
    if (order.buyer_id !== profile.id) {
      notifications.push({
        user_id: order.buyer_id,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Your order #${order.id.slice(0, 8)} has been cancelled${isVendor ? ' by the vendor' : ''}.`,
        data: { orderId, reason },
        created_at: new Date().toISOString(),
      });
    }

    // Notify vendor
    if (order.vendor_id !== profile.id) {
      notifications.push({
        user_id: order.vendor_id,
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order #${order.id.slice(0, 8)} has been cancelled${isBuyer ? ' by the buyer' : ''}.`,
        data: { orderId, reason },
        created_at: new Date().toISOString(),
      });
    }

    if (notifications.length > 0) {
      await supabase
        .from('notifications')
        .insert(notifications)
        .catch((err) => logger.warn('Failed to send notifications:', err));
    }

    // TODO: Send email notifications

    logger.info('Order cancelled successfully:', {
      orderId,
      cancelledBy: profile.id,
      refundAmount: calculatedRefundAmount,
    });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: orderId,
        status: 'cancelled',
        refundAmount: calculatedRefundAmount,
        refundStatus: order.payment_intent_id ? 'initiated' : 'not_applicable',
      },
    });
  } catch (error) {
    logger.error('Order cancellation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



