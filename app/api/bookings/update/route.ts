// CLERK MIGRATION: Updated to use Clerk authentication
import { NextRequest } from 'next/server'
import { createClientFromRequest } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { BookingUpdateSchema } from '@/lib/validations/schemas'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { safeEq, safeUpdate, safeInsert, hasProperty } from '@/lib/supabase-helpers'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Extended schema with date validation
const BookingUpdateSchemaWithValidation = BookingUpdateSchema.refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time)
    }
    return true
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
)

/**
 * PATCH /api/bookings/update
 * Update a booking (buyer or vendor can update)
 */
export const PATCH = withErrorHandling(async (req: NextRequest) => {
  // CLERK MIGRATION: Authenticate user with Clerk
  let userId: string
  try {
    userId = await getAuthUserId() // Throws if not authenticated
  } catch (authError) {
    logger.error('Authentication error in booking update', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated write: 30/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  const supabase = createClientFromRequest(req.headers.get('Authorization'))

  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('id')

  if (!bookingId) {
    return errorResponse('Booking ID is required', 'MISSING_ID')
  }

    // Get existing booking to verify ownership
    const { data: existingBooking, error: fetchError } = await safeEq(
      supabase
        .from('bookings')
        .select('id, buyer, vendor, status'),
      'id',
      bookingId
    ).maybeSingle()

  if (fetchError) {
    logger.error('Failed to fetch booking', fetchError, { bookingId })
    return internalErrorResponse('Failed to fetch booking', fetchError)
  }

  if (!existingBooking || !hasProperty(existingBooking, 'buyer') || !hasProperty(existingBooking, 'vendor')) {
    return notFoundResponse('Booking not found')
  }

  // Verify user is either buyer or vendor
  const isBuyer = existingBooking.buyer === userId
  const isVendor = existingBooking.vendor === userId

  if (!isBuyer && !isVendor) {
    return forbiddenResponse('You do not have permission to update this booking')
  }

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const updateData = validateRequest(BookingUpdateSchemaWithValidation, body)

  // Business logic: Only vendor can confirm/cancel, buyer can cancel
  if (updateData.status) {
    if (updateData.status === 'confirmed' && !isVendor) {
      return forbiddenResponse('Only the vendor can confirm a booking')
    }

    const currentStatus = hasProperty(existingBooking, 'status') ? existingBooking.status : ''
    if (updateData.status === 'canceled' && currentStatus === 'completed') {
      return errorResponse('Cannot cancel a completed booking', 'INVALID_STATUS')
    }
  }

  // Prepare update payload
  const updatePayload: Record<string, unknown> = {}
  if (updateData.status) updatePayload.status = updateData.status
  if (updateData.start_time) updatePayload.start_time = updateData.start_time
  if (updateData.end_time) updatePayload.end_time = updateData.end_time
  if (updateData.notes !== undefined) updatePayload.notes = updateData.notes

  // Update booking
  const { data: updatedBooking, error: updateError } = await safeEq(
    safeUpdate(
      supabase.from('bookings'),
      updatePayload
    ),
    'id',
    bookingId
  )
    .select()
    .maybeSingle()

  if (updateError) {
    logger.error('Booking update error', updateError, { bookingId, userId })
    return internalErrorResponse(updateError.message || 'Failed to update booking', updateError)
  }

  if (!updatedBooking) {
    return notFoundResponse('Booking not found or update failed')
  }

  // Create notification for the other party (non-blocking)
  const notifyUserId = isBuyer && hasProperty(existingBooking, 'vendor') 
    ? existingBooking.vendor 
    : hasProperty(existingBooking, 'buyer') 
      ? existingBooking.buyer 
      : null
  if (notifyUserId && updateData.status) {
    try {
      const statusMessages: Record<string, { title: string; message: string }> = {
        confirmed: {
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed by the vendor.',
        },
        canceled: {
          title: 'Booking Canceled',
          message: 'Your booking has been canceled.',
        },
        completed: {
          title: 'Booking Completed',
          message: 'Your booking has been marked as completed.',
        },
      }

      const message = statusMessages[updateData.status]
      if (message) {
        await safeInsert(
          supabase.from('notifications'),
          {
            user_id: notifyUserId,
            type: `booking_${updateData.status}`,
            data: {
              bookingId: bookingId,
              title: message.title,
              message: message.message,
            },
          }
        )
      }
    } catch (notifError) {
      logger.error('Failed to create notification', notifError, { bookingId, notifyUserId })
      // Don't fail the update, but log error
    }
  }

  return successResponse({ booking: updatedBooking }, 'Booking updated successfully')
})

