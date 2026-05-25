// API route for creating and managing listings
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
  safeJsonParse,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { ListingCreateSchema } from '@/lib/validators'
import { canCreateListing } from '@/lib/subscription-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/listings
 * Create a new listing
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse(
      'Authentication failed. Please sign in to create a listing.',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check
  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  // Parse and validate request body
  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const validationResult = ListingCreateSchema.safeParse(body)
  if (!validationResult.success) {
    return validationErrorResponse(validationResult.error)
  }

  const listingData = validationResult.data
  const adminClient = createAdminClient()

  try {
    // Check profile with explicit type
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, is_vendor, vendor_verified, is_admin')
      .eq('id', userId as any)
      .maybeSingle() as { data: { id: string; is_vendor: boolean; vendor_verified: boolean; is_admin: boolean } | null; error: any }

    if (profileError || !profile?.id) {
      return errorResponse('Profile not found', 'PROFILE_NOT_FOUND', 'Unable to load your profile')
    }

    const isAdmin = !!profile.is_admin
    let vendorId = listingData.vendor || profile.id

    if (!isAdmin) {
      if (!profile.is_vendor) {
        return errorResponse(
          'Vendor account required',
          'NOT_VENDOR',
          'You must have a vendor account to create listings'
        )
      }
      
      // Allow unverified vendors to create inactive listings (for onboarding)
      // Active listings require verification
      if (listingData.active && !profile.vendor_verified) {
        return errorResponse(
          'Verified vendor account required',
          'NOT_VERIFIED',
          'You must be a verified vendor to create active listings. You can create inactive listings during onboarding.'
        )
      }
      
      vendorId = profile.id

      // Check subscription listing limit
      // Get subscription info first to check limit and get details for error message
      const { getVendorSubscription } = await import('@/lib/subscription-utils')
      const subscriptionInfo = await getVendorSubscription(vendorId)
      
      // If subscription info exists and limit is reached, return error
      if (subscriptionInfo && !subscriptionInfo.canCreateListing) {
        const limit = subscriptionInfo.listingLimit
        const tier = subscriptionInfo.tier
        const currentCount = subscriptionInfo.currentListings

        return errorResponse(
          'Listing limit reached',
          'LISTING_LIMIT_REACHED',
          {
            message: `You have reached your listing limit (${currentCount}/${limit} listings) for the ${tier} tier. Please upgrade your subscription to create more listings.`,
            currentLimit: limit,
            currentCount: currentCount,
            tier: tier,
          },
          403
        )
      }
      
      // If no subscription info, allow creation (will use default free tier limits)
      // The listing will be created and vendor_profile will be created/updated if needed
    } else if (listingData.vendor && listingData.vendor !== profile.id) {
      const { data: vendorProfile, error: vendorError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', listingData.vendor as any)
        .maybeSingle() as { data: { id: string } | null; error: any }

      if (vendorError || !vendorProfile) {
        return errorResponse(
          'Vendor not found',
          'VENDOR_NOT_FOUND',
          'Unable to find the specified vendor'
        )
      }
    }

    // Ensure vendor_profile exists (create if missing with default values)
    // This handles vendors who haven't completed full onboarding yet
    const { data: existingVendorProfile } = await adminClient
      .from('vendor_profiles')
      .select('id')
      .eq('id', vendorId)
      .maybeSingle()

    if (!existingVendorProfile) {
      // Create vendor_profile with default free tier settings
      const { error: vendorProfileError } = await adminClient
        .from('vendor_profiles')
        .insert({
          id: vendorId,
          subscription_tier: 'free',
          subscription_status: 'active',
          listing_limit: 5,
          transaction_fee_percent: 2.0,
        } as any)

      if (vendorProfileError) {
        logger.warn('Failed to create vendor_profile, continuing anyway', vendorProfileError, { vendorId })
        // Don't fail listing creation if vendor_profile creation fails
        // The vendor_profile might be created later via webhook or other process
      } else {
        logger.info('Created vendor_profile with default settings', { vendorId })
      }
    }

    const { data: listing, error: createError } = await adminClient
      .from('listings')
      .insert({
        ...listingData,
        vendor: vendorId,
        active: listingData.active ?? false,
      } as any)
      .select()
      .single()

    if (createError) {
      logger.error('Failed to create listing', createError, { userId, listingData })
      return internalErrorResponse('Failed to create listing', createError)
    }

    return successResponse({ listing })
  } catch (error) {
    logger.error('Error creating listing', error)
    return internalErrorResponse('Failed to create listing', error)
  }
})

/**
 * GET /api/listings
 * Get listings (public endpoint - no auth required for browsing)
 * Supports filtering by vendor (for vendor dashboard - shows all listings including inactive)
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const adminClient = createAdminClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const vendor = searchParams.get('vendor') // For vendor dashboard - shows all their listings
  const page = parseInt(searchParams.get('page') || '0', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

  try {
    let query = adminClient
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    // If vendor filter is provided, show all their listings (active and inactive)
    // Otherwise, only show active listings (public marketplace)
    if (vendor) {
      // Check if vendor is a Clerk ID or UUID
      const isClerkId = vendor.startsWith('user_')
      if (isClerkId) {
        // Get profile UUID from Clerk ID
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('id', vendor)
          .maybeSingle()
        
        if (profile?.id) {
          query = query.eq('vendor', profile.id)
        } else {
          return successResponse({ listings: [] })
        }
      } else {
        query = query.eq('vendor', vendor)
      }
    } else {
      // Public marketplace - only active listings
      query = query.eq('active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.ilike('title', `%${search}%`)
    }

    // Apply pagination only for public marketplace (not vendor dashboard)
    if (!vendor) {
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)
    }

    const { data: listings, error } = await query

    if (error) {
      logger.error('Failed to fetch listings', error)
      return internalErrorResponse('Failed to fetch listings', error)
    }

    return successResponse({ listings: listings || [] })
  } catch (error) {
    logger.error('Error fetching listings', error)
    return internalErrorResponse('Failed to fetch listings', error)
  }
})
