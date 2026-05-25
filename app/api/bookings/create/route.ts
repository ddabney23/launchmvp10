// CLERK MIGRATION: Updated to use Clerk authentication
import { NextRequest } from 'next/server'
import { createClientFromRequest } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { BookingCreateSchema } from '@/lib/validations/schemas'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { safeEq, safeInsert, hasProperty } from '@/lib/supabase-helpers'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Extended schema with legacy field support
const BookingCreateSchemaWithLegacy = BookingCreateSchema.extend({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
}).refine(
  (data) => {
    const start = data.start_time || data.start_date
    const end = data.end_time || data.end_date
    if (start && end) {
      return new Date(end) > new Date(start)
    }
    return true
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
)

export const POST = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in booking create', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated write: 30/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  const supabase = createClientFromRequest(req.headers.get('Authorization'))

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const validationData = validateRequest(BookingCreateSchemaWithLegacy, body)

  const { listing_id, start_time, end_time, notes, start_date, end_date } = validationData

  // Support both old and new field names
  const startTime = start_time || start_date!
  const endTime = end_time || end_date!

  // Validate dates
  const startDate = new Date(startTime)
  const endDate = new Date(endTime)
  const now = new Date()

  if (startDate < now) {
    return errorResponse('Start time cannot be in the past', 'INVALID_DATE')
  }

  // Get profile UUID for buyer (userId is Clerk ID, need profile UUID)
  const { data: buyerProfile, error: buyerProfileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (buyerProfileError || !buyerProfile) {
    logger.error('Failed to fetch buyer profile', buyerProfileError, { userId })
    return internalErrorResponse(
      'Failed to fetch user profile. Please ensure you have completed onboarding.',
      buyerProfileError
    )
  }

  // Check if listing exists and is active
  const { data: listing, error: listingError } = await safeEq(
    supabase
      .from('listings')
      .select('id, vendor, price, active'),
    'id',
    listing_id
  ).maybeSingle()

  if (listingError) {
    logger.error('Failed to fetch listing', listingError, { listing_id })
    return internalErrorResponse('Failed to fetch listing', listingError)
  }

  if (!listing || !hasProperty(listing, 'active')) {
    return notFoundResponse('Listing not found')
  }

  if (!listing.active) {
    return errorResponse('Listing is not available for booking', 'LISTING_INACTIVE')
  }

  // Prevent users from booking their own listings (compare profile UUIDs, not Clerk IDs)
  if (hasProperty(listing, 'vendor') && listing.vendor === buyerProfile.id) {
    return errorResponse('You cannot book your own listing', 'INVALID_OPERATION')
  }

  // Check for conflicting bookings
  // A conflict exists if:
  // - Existing booking starts before new booking ends AND
  // - Existing booking ends after new booking starts
  let conflictQuery = supabase
    .from('bookings')
    .select('id, start_time, end_time')
  // @ts-expect-error - Supabase type inference issue with .in() method
  conflictQuery = conflictQuery.in('status', ['confirmed', 'pending'])
  conflictQuery = conflictQuery.lte('start_time', endDate.toISOString())
  conflictQuery = conflictQuery.gte('end_time', startDate.toISOString())
  const { data: conflicts, error: conflictError } = await safeEq(
    conflictQuery,
    'listing_id',
    listing_id
  )

  if (conflictError) {
    logger.error('Conflict check error', conflictError, { listing_id, startTime, endTime })
    return internalErrorResponse('Failed to check availability. Please try again.', conflictError)
  }

  if (conflicts && conflicts.length > 0) {
    return errorResponse(
      'Time slot not available. This time period is already booked.',
      'CONFLICT',
      { conflicts },
      409
    )
  }

  // Calculate total price (hours * hourly rate, or days * daily rate)
  const hours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
  const days = Math.ceil(hours / 24)
  const listingPrice = hasProperty(listing, 'price') ? Number(listing.price) : 0
  const totalPrice = days * listingPrice
  const listingVendor = hasProperty(listing, 'vendor') ? listing.vendor : ''

  // Create booking using correct column names (profile UUIDs, not Clerk IDs)
  const { data: booking, error: bookingError } = await safeInsert(
    supabase.from('bookings'),
    {
      listing_id,
      buyer: buyerProfile.id, // Use profile UUID, not Clerk ID
      vendor: listingVendor, // This should already be a profile UUID from listing
      start_time: startDate.toISOString(), // Use 'start_time' not 'start_date'
      end_time: endDate.toISOString(), // Use 'end_time' not 'end_date'
      status: 'pending',
      notes: notes || null,
    }
  )
    .select()
    .maybeSingle()

  if (bookingError || !booking) {
    logger.error('Booking creation error', bookingError, { listing_id, userId })
    return internalErrorResponse(
      bookingError?.message || 'Failed to create booking. Please try again.',
      bookingError
    )
  }

  // Create notification for vendor (non-blocking)
  if (booking && hasProperty(booking, 'id') && listingVendor) {
    try {
      await safeInsert(
        supabase.from('notifications'),
        {
          user_id: listingVendor,
          type: 'new_booking',
          data: {
            bookingId: hasProperty(booking, 'id') ? booking.id : '',
            listingId: listing_id,
            title: 'New Booking Request',
            message: `You have a new booking request for ${days} day(s).`,
          },
        }
      )
    } catch (notifError) {
      logger.error('Failed to create booking notification', notifError, {
        bookingId: hasProperty(booking, 'id') ? booking.id : '',
        vendorId: listingVendor,
      })
      // Don't fail booking creation, but log error
    }
  }

  return successResponse(
    { booking },
    'Booking created successfully. Waiting for vendor confirmation.'
  )
})

// GET endpoint to fetch user's bookings
export const GET = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in booking GET', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  const adminClient = createAdminClient()

  // Get profile UUID (userId is Clerk ID, bookings table uses profile UUIDs)
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.error('Failed to fetch profile in booking GET', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') // 'buyer' or 'vendor'

  let query = adminClient
    .from('bookings')
    .select(`
      *,
      listing:listings(id, title, images, price),
      buyer_profile:profiles!bookings_buyer_fkey(id, username, display_name, avatar_url),
      vendor_profile:profiles!bookings_vendor_fkey(id, username, display_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  // Filter by role - use profile UUID, not Clerk ID
  if (role === 'vendor') {
    query = query.eq('vendor', profile.id)
  } else {
    // Default to buyer bookings
    query = query.eq('buyer', profile.id)
  }

  const { data: bookings, error } = await query

  if (error) {
    logger.error('Fetch bookings error', error, { userId, role })
    return internalErrorResponse('Failed to fetch bookings. Please try again.', error)
  }

  return successResponse({ bookings: bookings || [] })
})

