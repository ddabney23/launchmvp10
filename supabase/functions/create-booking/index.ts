import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Parse request body
    const { listing_id, start_time, end_time, notes } = await req.json()

    if (!listing_id || !start_time || !end_time) {
      throw new Error('Missing required fields: listing_id, start_time, end_time')
    }

    const startTime = new Date(start_time)
    const endTime = new Date(end_time)

    // Validate time range
    if (endTime <= startTime) {
      throw new Error('End time must be after start time')
    }

    if (startTime < new Date()) {
      throw new Error('Start time cannot be in the past')
    }

    // Get listing and vendor info
    const { data: listing, error: listingError } = await supabaseClient
      .from('listings')
      .select('id, vendor, title, listing_type')
      .eq('id', listing_id)
      .single()

    if (listingError || !listing) {
      throw new Error('Listing not found')
    }

    if (listing.listing_type !== 'service') {
      throw new Error('Booking is only available for service listings')
    }

    if (listing.vendor === user.id) {
      throw new Error('Cannot book your own service')
    }

    // Check for conflicting bookings
    const { data: conflictingBookings, error: conflictError } = await supabaseClient
      .from('bookings')
      .select('id')
      .eq('listing_id', listing_id)
      .in('status', ['pending', 'confirmed'])
      .or(`and(start_time.lt.${endTime.toISOString()},end_time.gt.${startTime.toISOString()})`)

    if (conflictError) {
      throw new Error('Failed to check booking availability')
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      throw new Error('This time slot is already booked')
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        listing_id,
        buyer: user.id,
        vendor: listing.vendor,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pending',
        metadata: notes ? { notes } : null,
      })
      .select()
      .single()

    if (bookingError || !booking) {
      throw new Error('Failed to create booking')
    }

    // Create notification for vendor
    await supabaseClient.from('notifications').insert({
      user_id: listing.vendor,
      type: 'booking',
      title: 'New Booking Request',
      body: `${user.email || 'A user'} requested a booking for ${listing.title}`,
      metadata: { booking_id: booking.id, listing_id },
    })

    return new Response(
      JSON.stringify({ booking }),
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

