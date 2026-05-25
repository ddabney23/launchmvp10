import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Parse request body
    const { items, shipping_info } = await req.json()

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Invalid items')
    }

    // Validate inventory and calculate total
    let total = 0
    const orderItems = []

    for (const item of items) {
      const { data: listing, error: listingError } = await supabaseClient
        .from('listings')
        .select('id, price, stock, vendor, title')
        .eq('id', item.listing_id)
        .single()

      if (listingError || !listing) {
        throw new Error(`Listing ${item.listing_id} not found`)
      }

      if (!listing.stock || listing.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${listing.title}`)
      }

      const itemTotal = Number(listing.price) * item.quantity
      total += itemTotal

      orderItems.push({
        listing_id: listing.id,
        price: listing.price,
        quantity: item.quantity,
      })
    }

    // Get vendor from first item (for single-vendor orders, extend logic for multi-vendor if needed)
    const firstListing = orderItems.length > 0 ? 
      (await supabaseClient.from('listings').select('vendor').eq('id', orderItems[0].listing_id).single()).data : null

    // Create order in database
    // Note: For multi-vendor orders, you may need to create separate orders per vendor
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        buyer: user.id,
        vendor: firstListing?.vendor || null,
        status: 'pending',
        total: total.toFixed(2),
        currency: 'USD',
        metadata: {
          shipping_info,
        },
      })
      .select()
      .single()

    if (orderError || !order) {
      throw new Error('Failed to create order')
    }

    // Create order items
    const orderItemsData = orderItems.map(item => ({
      order_id: order.id,
      listing_id: item.listing_id,
      price: item.price,
      quantity: item.quantity,
    }))

    const { error: orderItemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsData)

    if (orderItemsError) {
      throw new Error('Failed to create order items')
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        order_id: order.id,
        user_id: user.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Update order with payment intent ID
    await supabaseClient
      .from('orders')
      .update({ stripe_payment_intent: paymentIntent.id })
      .eq('id', order.id)

    return new Response(
      JSON.stringify({
        order_id: order.id,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

