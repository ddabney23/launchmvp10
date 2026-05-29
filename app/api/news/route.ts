import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { successResponse, internalErrorResponse } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/** GET /api/news — public published articles */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') || 0)
    const pageSize = Math.min(Number(searchParams.get('pageSize') || 12), 50)

    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      logger.error('Failed to fetch public news', error)
      return internalErrorResponse('Failed to fetch news', error)
    }

    return successResponse({ news: data || [] })
  } catch (error) {
    logger.error('Public news GET error', error)
    return internalErrorResponse('Internal server error', error)
  }
}
