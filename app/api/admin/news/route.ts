import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { requireAdminUserId } from '@/lib/supabase-auth'
import { NewsCreateSchema } from '@/lib/validators'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/lib/api-response'
import { safeJsonParse } from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function ensureAdmin(req: NextRequest) {
  try {
    const adminUserId = await requireAdminUserId()
    const rateLimitResponse = await strictRateLimit(req, adminUserId)
    if (rateLimitResponse) {
      return { error: rateLimitResponse }
    }
    const adminClient = createAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, is_admin')
      .eq('id', adminUserId)
      .maybeSingle()
    return { adminClient, adminProfile: profile }
  } catch {
    return { error: forbiddenResponse('Admin access required') }
  }
}

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await ensureAdmin(req)
    if ('error' in adminCheck && adminCheck.error) {
      return adminCheck.error
    }

    const { adminClient } = adminCheck
    const { searchParams } = new URL(req.url)
    const includeUnpublished = searchParams.get('includeUnpublished') === 'true'
    const page = Number(searchParams.get('page') || 0)
    const pageSize = Number(searchParams.get('pageSize') || 50)

    let query = adminClient
      .from('news')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (!includeUnpublished) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch news', error)
      return internalErrorResponse('Failed to fetch news', error)
    }

    return successResponse({ news: data || [] })
  } catch (error) {
    logger.error('Admin news GET error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await ensureAdmin(req)
    if ('error' in adminCheck && adminCheck.error) {
      return adminCheck.error
    }

    const { adminClient, adminProfile } = adminCheck
    const body = await safeJsonParse<unknown>(req)

    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const validation = NewsCreateSchema.safeParse(body)
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues)
    }

    const newsData = validation.data

    const { data, error } = await adminClient
      .from('news')
      .insert({
        ...newsData,
        author: adminProfile.id,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create news', error)
      return internalErrorResponse('Failed to create news article', error)
    }

    return successResponse({ news: data }, 'News article created successfully')
  } catch (error) {
    logger.error('Admin news POST error', error)
    return internalErrorResponse('Internal server error', error)
  }
}

