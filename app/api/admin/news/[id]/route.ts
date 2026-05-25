import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { NewsUpdateSchema } from '@/lib/validators'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api-response'
import { safeJsonParse } from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ensureAdmin(req: NextRequest) {
  const adminUserId = await getAuthUserId()

  const rateLimitResponse = await strictRateLimit(req, adminUserId)
  if (rateLimitResponse) {
    return { error: rateLimitResponse }
  }

  const adminClient = createAdminClient()
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', adminUserId)
    .maybeSingle()

  if (error || !profile?.is_admin) {
    return { error: forbiddenResponse('Admin access required') }
  }

  return { adminClient, adminProfile: profile }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await ensureAdmin(req)
    if ('error' in adminCheck && adminCheck.error) {
      return adminCheck.error
    }

    const { adminClient } = adminCheck
    const { id } = await params

    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const validation = NewsUpdateSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues)
    }

    const updates = validation.data

    const { data, error } = await adminClient
      .from('news')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logger.error('Failed to update news article', error, { id })
      return internalErrorResponse('Failed to update news article', error)
    }

    if (!data) {
      return notFoundResponse('News article not found')
    }

    return successResponse({ news: data }, 'News article updated successfully')
  } catch (error) {
    logger.error('Admin news PATCH error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await ensureAdmin(_req)
    if ('error' in adminCheck && adminCheck.error) {
      return adminCheck.error
    }

    const { adminClient } = adminCheck
    const { id } = await params

    const { data: existing, error: fetchError } = await adminClient
      .from('news')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      logger.error('Failed to load news article before delete', fetchError, { id })
      return internalErrorResponse('Failed to delete news article', fetchError)
    }

    if (!existing) {
      return notFoundResponse('News article not found')
    }

    const { error } = await adminClient
      .from('news')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Failed to delete news article', error, { id })
      return internalErrorResponse('Failed to delete news article', error)
    }

    return successResponse({ success: true }, 'News article deleted')
  } catch (error) {
    logger.error('Admin news DELETE error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

