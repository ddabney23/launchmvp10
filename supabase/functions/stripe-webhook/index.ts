import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata.order_id

        if (orderId) {
          // Update order status to paid
          await supabaseAdmin
            .from('orders')
            .update({ 
              status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)

          // Deduct stock from listings
          const { data: orderItems } = await supabaseAdmin
            .from('order_items')
            .select('listing_id, quantity')
            .eq('order_id', orderId)

          if (orderItems) {
            for (const item of orderItems) {
              // Get current stock
              const { data: listing } = await supabaseAdmin
                .from('listings')
                .select('stock')
                .eq('id', item.listing_id)
                .single()

              if (listing && listing.stock !== null) {
                // Decrement stock
                await supabaseAdmin
                  .from('listings')
                  .update({ 
                    stock: Math.max(0, listing.stock - item.quantity),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', item.listing_id)
              }
            }
          }

          // Create notification for vendor
          const { data: order } = await supabaseAdmin
            .from('orders')
            .select('vendor')
            .eq('id', orderId)
            .single()

          if (order?.vendor) {
            await supabaseAdmin.from('notifications').insert({
              user_id: order.vendor,
              type: 'order',
              title: 'New Order Received',
              body: `You have received a new order (#${orderId.slice(0, 8)})`,
              metadata: { order_id: orderId },
            })
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const failedPayment = event.data.object as Stripe.PaymentIntent
        const failedOrderId = failedPayment.metadata.order_id

        if (failedOrderId) {
          await supabaseAdmin
            .from('orders')
            .update({ 
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', failedOrderId)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

