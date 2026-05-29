import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import { successResponse, notFoundResponse, internalErrorResponse } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/** GET /api/news/[id] — public single published article */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch news article', error, { id })
      return internalErrorResponse('Failed to fetch news article', error)
    }

    if (!data) {
      return notFoundResponse('News article not found')
    }

    try {
      await adminClient.rpc('increment_news_view_count', { news_id: id })
    } catch {
      // RPC optional
    }

    return successResponse({ news: data })
  } catch (error) {
    logger.error('Public news item GET error', error)
    return internalErrorResponse('Internal server error', error)
  }
}
