// CLERK MIGRATION: Vendor balance API
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
    .select('payout_account_id, stripe_connect_account_id, payout_balance')
    .eq('id', vendorId)
    .maybeSingle()

  const connectAccountId =
    vendorProfile?.payout_account_id || vendorProfile?.stripe_connect_account_id

  // Get lifetime earnings from completed orders
  const { data: orders } = await adminClient
    .from('orders')
    .select('total')
    .eq('vendor', vendorId)
    .in('status', ['paid', 'completed'])

  const lifetimeEarnings = orders?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0

  if (!connectAccountId) {
    return successResponse({
      current_balance: Number(vendorProfile?.payout_balance || 0),
      pending_balance: 0,
      available_balance: Number(vendorProfile?.payout_balance || 0),
      lifetime_earnings: lifetimeEarnings,
    })
  }

  try {
    // Get balance from Stripe
    const balance = await stripe.balance.retrieve({
      stripeAccount: connectAccountId,
    })

    // Calculate balances
    const available = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100
    const pending = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100
    const current = available + pending

    return successResponse({
      current_balance: current,
      pending_balance: pending,
      available_balance: available,
      lifetime_earnings: lifetimeEarnings,
    })
  } catch (error) {
    logger.error('Error fetching balance', error, { vendorId })
    // Fallback to database balance
    return successResponse({
      current_balance: Number(vendorProfile.payout_balance || 0),
      pending_balance: 0,
      available_balance: Number(vendorProfile.payout_balance || 0),
      lifetime_earnings: lifetimeEarnings,
    })
  }
})

