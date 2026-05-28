import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { requireAdminUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { BadgeAssignSchema, BadgeRemoveSchema } from '@/lib/validations/schemas'
import { safeEq } from '@/lib/supabase-helpers'
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

async function requireAdminForRequest(req: NextRequest) {
  const adminUserId = await requireAdminUserId()
  const rateLimitResponse = await strictRateLimit(req, adminUserId)
  if (rateLimitResponse) {
    return { error: rateLimitResponse } as const
  }
  return { adminUserId, supabase: createAdminClient() } as const
}

// GET /api/admin/users/[id]/badges - Get user's badges
export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    let supabase: ReturnType<typeof createAdminClient>
    try {
      const admin = await requireAdminForRequest(req)
      if ('error' in admin) return admin.error
      supabase = admin.supabase
    } catch {
      return forbiddenResponse('Admin access required')
    }

    const { id } = await params

    const { data: userBadges, error } = await safeEq(
      supabase
        .from('profile_badges')
        .select(
          `
        id,
        awarded_at,
        badge:badges (
          id,
          key,
          name,
          description,
          icon
        )
      `
        ),
      'profile_id',
      id
    )

    if (error) {
      logger.error('Failed to fetch user badges', error, { userId: id })
      return internalErrorResponse('Failed to fetch badges', error)
    }

    return successResponse({ badges: userBadges || [] })
  }
)

// POST /api/admin/users/[id]/badges - Add badge to user
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    let userId: string
    let supabase: ReturnType<typeof createAdminClient>
    try {
      const admin = await requireAdminForRequest(req)
      if ('error' in admin) return admin.error
      userId = admin.adminUserId
      supabase = admin.supabase
    } catch {
      return forbiddenResponse('Admin access required')
    }

    const { id } = await params

    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const { badge_id } = validateRequest(BadgeAssignSchema, body)

    const { data: badge, error: badgeError } = await safeEq(
      supabase.from('badges').select('id, name'),
      'id',
      badge_id
    ).maybeSingle()

    if (badgeError) {
      logger.error('Failed to fetch badge', badgeError, { badge_id })
      return internalErrorResponse('Failed to fetch badge', badgeError)
    }

    if (!badge) {
      return notFoundResponse('Badge not found')
    }

    const { data: userBadge, error } = await supabase
      .from('profile_badges')
      // @ts-expect-error - Supabase insert type inference issue with strict mode
      .insert({
        profile_id: id,
        badge_id: badge_id,
        awarded_by: userId,
      })
      .select(
        `
        id,
        awarded_at,
        badge:badges (
          id,
          key,
          name,
          description,
          icon
        )
      `
      )
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return errorResponse('User already has this badge', 'DUPLICATE_BADGE')
      }
      logger.error('Failed to add badge to user', error, { userId: id, badgeId: badge_id })
      return internalErrorResponse('Failed to add badge', error)
    }

    if (!userBadge) {
      return internalErrorResponse('Failed to create badge assignment')
    }

    try {
      await supabase.from('audit_logs')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: userId,
          action: 'badge_awarded',
          resource_type: 'user_badge',
          resource_id: id,
          metadata: {
            badge_id: badge_id,
            badge_name: 'name' in badge ? badge.name : 'Unknown',
            target_user_id: id,
          },
        })
    } catch (auditError) {
      logger.error('Failed to create audit log', auditError)
    }

    return successResponse({ badge: userBadge })
  }
)

// DELETE /api/admin/users/[id]/badges - Remove badge from user
export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    let userId: string
    let supabase: ReturnType<typeof createAdminClient>
    try {
      const admin = await requireAdminForRequest(req)
      if ('error' in admin) return admin.error
      userId = admin.adminUserId
      supabase = admin.supabase
    } catch {
      return forbiddenResponse('Admin access required')
    }

    const { id } = await params

    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const { badge_id } = validateRequest(BadgeRemoveSchema, body)

    const { data: badge, error: badgeError } = await safeEq(
      supabase.from('badges').select('name'),
      'id',
      badge_id
    ).maybeSingle()

    if (badgeError) {
      logger.error('Failed to fetch badge', badgeError, { badge_id })
    }

    const { error } = await safeEq(
      safeEq(supabase.from('profile_badges').delete(), 'profile_id', id),
      'badge_id',
      badge_id
    )

    if (error) {
      logger.error('Failed to remove badge from user', error, { userId: id, badgeId: badge_id })
      return internalErrorResponse('Failed to remove badge', error)
    }

    try {
      await supabase.from('audit_logs')
        // @ts-expect-error - Supabase insert type inference issue with strict mode
        .insert({
          user_id: userId,
          action: 'badge_removed',
          resource_type: 'user_badge',
          resource_id: id,
          metadata: {
            badge_id: badge_id,
            badge_name: badge && 'name' in badge ? badge.name : null,
            target_user_id: id,
          },
        })
    } catch (auditError) {
      logger.error('Failed to create audit log', auditError)
    }

    return successResponse({ success: true })
  }
)
