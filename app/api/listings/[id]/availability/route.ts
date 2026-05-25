// API route to get available time slots for a listing
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/listings/[id]/availability
 * Get available time slots for a listing on a specific date or date range
 * Query params:
 * - date: ISO date string (YYYY-MM-DD) - optional, defaults to today
 * - days: number of days to check (default: 30)
 */
export const GET = withErrorHandling(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const adminClient = createAdminClient()
  const { id: listingId } = await params
  const { searchParams } = new URL(req.url)
  
  const dateParam = searchParams.get('date')
  const daysParam = searchParams.get('days')
  const days = daysParam ? parseInt(daysParam, 10) : 30

  // Validate listing exists
  const { data: listing, error: listingError } = await adminClient
    .from('listings')
    .select('id, active, vendor')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    logger.error('Failed to fetch listing for availability', listingError, { listingId })
    return internalErrorResponse('Failed to fetch listing', listingError)
  }

  if (!listing) {
    return notFoundResponse('Listing not found')
  }

  if (!listing.active) {
    return errorResponse('Listing is not active', 'LISTING_INACTIVE')
  }

  // Calculate date range
  const startDate = dateParam ? new Date(dateParam) : new Date()
  startDate.setHours(0, 0, 0, 0)
  
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + days)
  endDate.setHours(23, 59, 59, 999)

  // Get all bookings for this listing in the date range
  const { data: bookings, error: bookingsError } = await adminClient
    .from('bookings')
    .select('id, start_time, end_time, status')
    .eq('listing_id', listingId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .order('start_time', { ascending: true })

  if (bookingsError) {
    logger.error('Failed to fetch bookings for availability', bookingsError, { listingId })
    return internalErrorResponse('Failed to fetch bookings', bookingsError)
  }

  // Generate available time slots
  // Default: 9 AM to 6 PM, 1-hour slots
  const availableSlots: Array<{
    date: string
    timeSlots: Array<{
      start: string
      end: string
      available: boolean
    }>
  }> = []

  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const timeSlots: Array<{ start: string; end: string; available: boolean }> = []

    // Generate hourly slots from 9 AM to 6 PM
    for (let hour = 9; hour < 18; hour++) {
      const slotStart = new Date(currentDate)
      slotStart.setHours(hour, 0, 0, 0)
      
      const slotEnd = new Date(currentDate)
      slotEnd.setHours(hour + 1, 0, 0, 0)

      // Check if this slot conflicts with any booking
      const isAvailable = !bookings?.some(booking => {
        const bookingStart = new Date(booking.start_time)
        const bookingEnd = new Date(booking.end_time)
        
        // Slot is unavailable if it overlaps with a booking
        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        )
      })

      // Don't show past time slots
      const isPast = slotStart < new Date()

      timeSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        available: isAvailable && !isPast,
      })
    }

    availableSlots.push({
      date: dateStr,
      timeSlots,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Calculate summary statistics
  const totalSlots = availableSlots.reduce((sum, day) => sum + day.timeSlots.length, 0)
  const availableCount = availableSlots.reduce(
    (sum, day) => sum + day.timeSlots.filter(slot => slot.available).length,
    0
  )

  return successResponse({
    listing_id: listingId,
    date_range: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    availability: availableSlots,
    summary: {
      total_slots: totalSlots,
      available_slots: availableCount,
      booked_slots: totalSlots - availableCount,
    },
  })
})

