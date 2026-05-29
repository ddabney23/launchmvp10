// CLERK MIGRATION: Vendor payout management API
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { strictRateLimit } from '@/lib/rate-limit'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
})

export const GET = withErrorHandling(async (req: NextRequest) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return internalErrorResponse('Payment system not configured')
  }

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

  // Get user's profile UUID
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    return unauthorizedResponse('Profile not found')
  }

  // Get vendorId from query params
  const { searchParams } = new URL(req.url)
  const vendorId = searchParams.get('vendorId')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  if (!vendorId) {
    return errorResponse('Vendor ID is required', 'MISSING_VENDOR_ID', 400)
  }

  // Verify user owns this vendor profile
  if (vendorId !== profile.id) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 403)
  }

  // Get vendor's Stripe Connect account
  const { data: vendorProfile } = await adminClient
    .from('vendor_profiles')
    .select('payout_account_id, stripe_connect_account_id')
    .eq('id', vendorId)
    .maybeSingle()

  const connectAccountId =
    vendorProfile?.payout_account_id || vendorProfile?.stripe_connect_account_id

  if (!connectAccountId) {
    return successResponse([]) // No Connect account, no payouts
  }

  try {
    // Get payouts from Stripe
    const payouts = await stripe.payouts.list(
      {
        limit,
      },
      {
        stripeAccount: connectAccountId,
      }
    )

    return successResponse(
      payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount / 100, // Convert from cents
        currency: payout.currency,
        status: payout.status,
        arrival_date: payout.arrival_date,
        created: payout.created,
        method: payout.method,
        type: payout.type,
      }))
    )
  } catch (error) {
    logger.error('Error fetching payouts', error, { vendorId })
    return internalErrorResponse('Failed to fetch payouts', error)
  }
})
