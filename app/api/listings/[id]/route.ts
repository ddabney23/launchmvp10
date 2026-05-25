import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  safeJsonParse,
  successResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { ListingCreateSchema } from '@/lib/validators'

export const dynamic = 'force-dynamic'

const ListingUpdateSchema = ListingCreateSchema.partial()

async function authorizeListingAccess(
  adminClient: ReturnType<typeof createAdminClient>,
  clerkUserId: string,
  listingId: string
) {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', clerkUserId)
    .maybeSingle()

  if (profileError || !profile?.id) {
    return { error: errorResponse('Profile not found', 'PROFILE_NOT_FOUND') }
  }

  const { data: listing, error: listingError } = await adminClient
    .from('listings')
    .select('id, vendor')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    logger.error('Failed to load listing for authorization', listingError, { listingId })
    return { error: internalErrorResponse('Failed to load listing', listingError) }
  }

  if (!listing) {
    return { error: notFoundResponse('Listing not found') }
  }

  const isOwner = listing.vendor === profile.id
  const isAdmin = !!profile.is_admin

  if (!isOwner && !isAdmin) {
    return { error: forbiddenResponse('You do not have permission to modify this listing') }
  }

  return { listing, profile }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminClient = createAdminClient()
    const { id } = await params

    const { data: listing, error } = await adminClient
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch listing', error, { id })
      return internalErrorResponse('Failed to fetch listing', error)
    }

    if (!listing) {
      return notFoundResponse('Listing not found')
    }

    return successResponse({ listing })
  } catch (error) {
    logger.error('Listing GET error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkUserId = await getAuthUserId()
    const adminClient = createAdminClient()
    const { id } = await params

    const authResult = await authorizeListingAccess(adminClient, clerkUserId, id)
    if ('error' in authResult && authResult.error) {
      return authResult.error
    }

    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const validation = ListingUpdateSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues)
    }

    const updates = { ...validation.data } as Record<string, any>
    if (updates.vendor) {
      // Only admins can reassign vendors
      if (!authResult.profile?.is_admin) {
        delete updates.vendor
      } else {
        const { data: vendorCheck } = await adminClient
          .from('profiles')
          .select('id')
          .eq('id', updates.vendor)
          .maybeSingle()
        if (!vendorCheck) {
          return errorResponse('Vendor not found', 'VENDOR_NOT_FOUND')
        }
      }
    }

    if (updates.media_urls !== undefined) {
      updates.images = updates.media_urls
      delete updates.media_urls
    }

    const { data: listing, error } = await adminClient
      .from('listings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Failed to update listing', error, { id, updates })
      return internalErrorResponse('Failed to update listing', error)
    }

    if (!listing) {
      return notFoundResponse('Listing not found')
    }

    return successResponse({ listing })
  } catch (error) {
    logger.error('Listing update error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clerkUserId = await getAuthUserId()
    const adminClient = createAdminClient()
    const { id } = await params

    const authResult = await authorizeListingAccess(adminClient, clerkUserId, id)
    if ('error' in authResult && authResult.error) {
      return authResult.error
    }

    const { error } = await adminClient
      .from('listings')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Failed to delete listing', error, { id })
      return internalErrorResponse('Failed to delete listing', error)
    }

    return successResponse({ success: true }, 'Listing deleted')
  } catch (error) {
    logger.error('Listing delete error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

