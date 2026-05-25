// CLERK MIGRATION: Order update API
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { strictRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  internalErrorResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export const PATCH = withErrorHandling(async (
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) => {
  // Authenticate user
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse('Authentication failed')
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()
  const { orderId } = await context.params

  // Get user's profile UUID
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return unauthorizedResponse('Profile not found')
  }

  // Get order
  const { data: order, error: orderError } = await adminClient
    .from('orders')
    .select('id, vendor, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return notFoundResponse('Order not found')
  }

  // Verify user is the vendor for this order
  if (order.vendor !== profile.id) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 403)
  }

  // Parse request body
  const body = await safeJsonParse<{ status?: string; [key: string]: any }>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 400)
  }

  // Validate status transitions
  const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled']
  if (body.status && !validStatuses.includes(body.status)) {
    return errorResponse('Invalid order status', 'INVALID_STATUS', 400)
  }

  // Validate status transitions
  const currentStatus = order.status
  const newStatus = body.status

  if (newStatus) {
    const validTransitions: Record<string, string[]> = {
      'pending': ['paid', 'cancelled'],
      'paid': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['completed'],
      'completed': [], // Cannot change from completed
      'cancelled': [], // Cannot change from cancelled
    }

    const allowedTransitions = validTransitions[currentStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      return errorResponse(
        `Cannot change status from ${currentStatus} to ${newStatus}`,
        'INVALID_STATUS_TRANSITION',
        400
      )
    }
  }

  // Update order
  const { data: updatedOrder, error: updateError } = await adminClient
    .from('orders')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single()

  if (updateError) {
    logger.error('Error updating order', updateError, { orderId })
    return internalErrorResponse('Failed to update order', updateError)
  }

  return successResponse(updatedOrder)
})

