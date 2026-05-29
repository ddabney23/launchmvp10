import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { webhookRateLimit } from '@/lib/rate-limit'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
  logger.warn(
    'Stripe webhook env missing (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET). Webhook route will return 500 until configured.'
  )
}

const stripe = new Stripe(STRIPE_SECRET_KEY || 'sk_test_placeholder')
const webhookSecret = WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  // Webhook rate limit check (100 req/min)
  const rateLimitResponse = await webhookRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse

  // Validate Stripe configuration at runtime
  if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    logger.error('Stripe webhook called but environment variables are missing')
    return NextResponse.json(
      { error: 'Stripe webhook not configured' },
      { status: 500 }
    )
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    )
  }

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook signature verification failed', err, { signature: sig?.substring(0, 20) })
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }

  // Handle the event
  const supabaseAdmin = createAdminClient()
  let webhookStatus: 'success' | 'failed' = 'success'
  let webhookError: string | undefined

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent)
        break
        
      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge)
        break

      // Subscription events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      // Stripe Connect events
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer)
        break

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout)
        break

      default:
        logger.info(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
    
  } catch (error: unknown) {
    webhookStatus = 'failed'
    webhookError = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Webhook processing error', error, { eventType: event?.type })
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  } finally {
    // Log webhook event to database
    try {
      await supabaseAdmin
        .from('webhook_logs')
        .insert({
          source: 'stripe',
          event_type: event.type,
          status: webhookStatus,
          payload: event.data.object as unknown as Record<string, unknown>,
          error: webhookError || null,
        })
    } catch (logError) {
      // Don't fail webhook if logging fails
      logger.error('Failed to log webhook event', logError, { eventType: event.type })
    }
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId

  if (!orderId) {
    logger.error('No orderId in payment intent metadata', undefined, { paymentIntentId: paymentIntent.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Update order status
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ 
      status: 'paid',
      stripe_payment_intent: paymentIntent.id,
    })
    .eq('id', orderId)

  if (updateError) {
    logger.error('Failed to update order', updateError, { orderId, paymentIntentId: paymentIntent.id })
    throw updateError
  }

  // Get order details for notification
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('buyer, total')
    .eq('id', orderId)
    .maybeSingle()

  if (order && order.buyer) {
    // Create notification for customer
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: order.buyer,
        type: 'payment_success',
        data: { 
          orderId, 
          paymentIntentId: paymentIntent.id,
          title: 'Payment Successful',
          message: `Your payment of $${Number(order.total).toFixed(2)} has been processed successfully.`
        }
      })
    
    if (notifError) {
      logger.error('Failed to create payment success notification', notifError, { orderId, userId: order.buyer })
      // Don't fail webhook, but log error
    }
  }

  logger.info(`Payment succeeded for order ${orderId}`, { orderId, paymentIntentId: paymentIntent.id })
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId

  if (!orderId) {
    logger.warn('No orderId in payment intent metadata for failed payment', { paymentIntentId: paymentIntent.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Update order status
  await supabaseAdmin
    .from('orders')
    .update({ 
      status: 'payment_failed',
      stripe_payment_intent: paymentIntent.id
    })
    .eq('id', orderId)

  // Get order details
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('buyer')
    .eq('id', orderId)
    .maybeSingle()

  if (order && order.buyer) {
    // Notify customer of failure
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: order.buyer,
        type: 'payment_failed',
        data: { 
          orderId, 
          reason: paymentIntent.last_payment_error?.message,
          title: 'Payment Failed',
          message: 'Your payment could not be processed. Please try again or use a different payment method.'
        }
      })
    
    if (notifError) {
      logger.error('Failed to create payment failed notification', notifError, { orderId, userId: order.buyer })
      // Don't fail webhook, but log error
    }
  }

  logger.warn(`Payment failed for order ${orderId}`, { orderId, paymentIntentId: paymentIntent.id, error: paymentIntent.last_payment_error?.message })
}

async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId

  if (!orderId) {
    logger.warn('No orderId in payment intent metadata for canceled payment', { paymentIntentId: paymentIntent.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  await supabaseAdmin
    .from('orders')
    .update({ 
      status: 'canceled',
      stripe_payment_intent: paymentIntent.id
    })
    .eq('id', orderId)

  logger.info(`Payment canceled for order ${orderId}`, { orderId, paymentIntentId: paymentIntent.id })
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string

  if (!paymentIntentId) {
    logger.warn('No payment intent ID in charge for refund', { chargeId: charge.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Find order by payment intent
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer')
    .eq('stripe_payment_intent', paymentIntentId)
    .maybeSingle()

  if (order) {
    // Update order status
    await supabaseAdmin
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', order.id)

    // Notify customer
    if (order.buyer) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: order.buyer,
          type: 'refund_processed',
          data: { 
            orderId: order.id, 
            chargeId: charge.id,
            title: 'Refund Processed',
            message: `Your refund of $${(charge.amount_refunded / 100).toFixed(2)} has been processed.`
          }
        })
    }

    logger.info(`Refund processed for order ${order.id}`, { orderId: order.id, chargeId: charge.id, amount: charge.amount_refunded })
  } else {
    logger.warn('Order not found for refund', { paymentIntentId, chargeId: charge.id })
  }
}

// Subscription event handlers
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const vendorId = subscription.metadata.vendor_id
  if (!vendorId) {
    logger.warn('No vendor_id in subscription metadata', { subscriptionId: subscription.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  const { error: updateError } = await supabaseAdmin
    .from('vendor_subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('vendor_id', vendorId)

  if (updateError) {
    logger.error('Failed to update subscription on creation', updateError, { subscriptionId: subscription.id, vendorId })
    throw updateError
  }

  logger.info(`Subscription created for vendor ${vendorId}`, { subscriptionId: subscription.id, vendorId })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const vendorId = subscription.metadata.vendor_id
  if (!vendorId) {
    logger.warn('No vendor_id in subscription metadata', { subscriptionId: subscription.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Get tier from price
  const priceId = subscription.items.data[0]?.price.id
  let tier = 'free'
  if (priceId) {
    // Determine tier from price ID (should match env vars)
    if (priceId === process.env.STRIPE_PRICE_BASIC) tier = 'basic'
    else if (priceId === process.env.STRIPE_PRICE_PRO) tier = 'pro'
    else if (priceId === process.env.STRIPE_PRICE_PREMIUM) tier = 'premium'
  }

  const { error: updateError } = await supabaseAdmin
    .from('vendor_subscriptions')
    .update({
      tier: tier,
      stripe_price_id: priceId || null,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('vendor_id', vendorId)

  if (updateError) {
    logger.error('Failed to update subscription', updateError, { subscriptionId: subscription.id, vendorId })
    throw updateError
  }

  logger.info(`Subscription updated for vendor ${vendorId}`, { subscriptionId: subscription.id, vendorId, tier })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const vendorId = subscription.metadata.vendor_id
  if (!vendorId) {
    logger.warn('No vendor_id in subscription metadata', { subscriptionId: subscription.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Downgrade to free tier
  const { error: updateError } = await supabaseAdmin
    .from('vendor_subscriptions')
    .update({
      tier: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_customer_id: null,
      stripe_price_id: null,
      cancel_at_period_end: false,
    })
    .eq('vendor_id', vendorId)

  if (updateError) {
    logger.error('Failed to update subscription on deletion', updateError, { subscriptionId: subscription.id, vendorId })
    throw updateError
  }

  logger.info(`Subscription canceled for vendor ${vendorId}`, { subscriptionId: subscription.id, vendorId })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) {
    logger.warn('No subscription ID in invoice', { invoiceId: invoice.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Get subscription to find vendor
  const { data: subscription } = await supabaseAdmin
    .from('vendor_subscriptions')
    .select('vendor_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (subscription) {
    // Update subscription status to active
    await supabaseAdmin
      .from('vendor_subscriptions')
      .update({
        status: 'active',
      })
      .eq('vendor_id', subscription.vendor_id)

    logger.info(`Invoice payment succeeded for subscription ${subscriptionId}`, { subscriptionId, vendorId: subscription.vendor_id })
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) {
    logger.warn('No subscription ID in invoice', { invoiceId: invoice.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Get subscription to find vendor
  const { data: subscription } = await supabaseAdmin
    .from('vendor_subscriptions')
    .select('vendor_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (subscription) {
    // Update subscription status to past_due
    await supabaseAdmin
      .from('vendor_subscriptions')
      .update({
        status: 'past_due',
      })
      .eq('vendor_id', subscription.vendor_id)

    logger.warn(`Invoice payment failed for subscription ${subscriptionId}`, { subscriptionId, vendorId: subscription.vendor_id })
  }
}

// Stripe Connect event handlers
async function handleAccountUpdated(account: Stripe.Account) {
  const vendorId = account.metadata.vendor_id
  if (!vendorId) {
    logger.warn('No vendor_id in account metadata', { accountId: account.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Determine onboard status
  let onboardStatus = 'pending'
  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    onboardStatus = 'active'
  } else if (account.requirements?.currently_due?.length > 0) {
    onboardStatus = 'restricted'
  }

  const { error: updateError } = await supabaseAdmin
    .from('vendor_profiles')
    .update({
      stripe_onboard_status: onboardStatus,
    })
    .or(`payout_account_id.eq.${account.id},stripe_connect_account_id.eq.${account.id}`)

  if (updateError) {
    logger.error('Failed to update vendor profile on account update', updateError, { accountId: account.id, vendorId })
    throw updateError
  }

  logger.info(`Account updated for vendor ${vendorId}`, { accountId: account.id, vendorId, onboardStatus })
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const vendorId = transfer.metadata.vendor_id
  if (!vendorId) {
    logger.warn('No vendor_id in transfer metadata', { transferId: transfer.id })
    return
  }

  const supabaseAdmin = createAdminClient()

  // Get vendor profile
  const destination = transfer.destination as string
  const { data: vendorProfile } = await supabaseAdmin
    .from('vendor_profiles')
    .select('id')
    .or(`payout_account_id.eq.${destination},stripe_connect_account_id.eq.${destination}`)
    .maybeSingle()

  if (vendorProfile) {
    // Update payout record if exists
    await supabaseAdmin
      .from('payouts')
      .update({
        status: 'paid',
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_payout_id', transfer.id)

    logger.info(`Transfer created for vendor ${vendorId}`, { transferId: transfer.id, vendorId, amount: transfer.amount })
  }
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  const supabaseAdmin = createAdminClient()

  // Find payout record
  const { data: payoutRecord } = await supabaseAdmin
    .from('payouts')
    .select('id, vendor_id')
    .eq('stripe_payout_id', payout.id)
    .maybeSingle()

  if (payoutRecord) {
    // Update payout status
    await supabaseAdmin
      .from('payouts')
      .update({
        status: 'paid',
        processed_at: new Date().toISOString(),
      })
      .eq('id', payoutRecord.id)

    logger.info(`Payout paid for vendor ${payoutRecord.vendor_id}`, { payoutId: payout.id, vendorId: payoutRecord.vendor_id })
  }
}

