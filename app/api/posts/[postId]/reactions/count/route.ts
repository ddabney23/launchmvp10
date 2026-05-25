// API route for getting reaction count for a post
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/posts/[postId]/reactions/count
 * Get the total reaction count for a post
 */
export const GET = withErrorHandling(async (
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) => {
  const { postId } = await params

  if (!postId) {
    return errorResponse('Post ID is required', 'MISSING_POST_ID')
  }

  const adminClient = createAdminClient()

  // Get count of reactions for this post
  const { count, error } = await adminClient
    .from('post_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  if (error) {
    logger.error('Failed to get reaction count', error, { postId })
    return internalErrorResponse('Failed to get reaction count', error)
  }

  return successResponse({ count: count || 0 })
})
