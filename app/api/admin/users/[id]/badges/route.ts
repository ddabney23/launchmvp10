import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import { BadgeAssignSchema, BadgeRemoveSchema } from '@/lib/validations/schemas'
import { safeEq, hasProperty } from '@/lib/supabase-helpers'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
  safeJsonParse,
  validateRequest,
  withErrorHandling,
} from '@/lib/api-response'
import { strictRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/admin/users/[id]/badges - Get user's badges
export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Authenticate admin
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in admin user badges', authError)
      return unauthorizedResponse(
        'Authentication failed',
        authError instanceof Error ? authError.message : 'Unauthorized'
      )
    }

    // Strict rate limit check (admin: 10/min)
    const rateLimitResponse = await strictRateLimit(req, userId)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = createAdminClient()
    const { id } = await params

    // Check if requester is admin
    const { data: adminProfile, error: adminCheckError } = await safeEq(
      supabase
        .from('profiles')
        .select('is_admin'),
      'id',
      userId
    ).maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    // Get user's badges with badge details
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
    // Authenticate admin
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in admin user badges POST', authError)
      return unauthorizedResponse(
        'Authentication failed',
        authError instanceof Error ? authError.message : 'Unauthorized'
      )
    }

    // Strict rate limit check (admin: 10/min)
    const rateLimitResponse = await strictRateLimit(req, userId)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = createAdminClient()
    const { id } = await params

    // Check if requester is admin
    const { data: adminProfile, error: adminCheckError } = await safeEq(
      supabase
        .from('profiles')
        .select('is_admin'),
      'id',
      userId
    ).maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    // Parse and validate request body
    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const { badge_id } = validateRequest(BadgeAssignSchema, body)

    // Verify badge exists
    const { data: badge, error: badgeError } = await safeEq(
      supabase
        .from('badges')
        .select('id, name'),
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

    // Add badge to user
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

    // Log audit trail (non-blocking)
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

    logger.info('Badge added to user', {
      adminId: userId,
      userId: id,
      badgeId: badge_id,
      badgeName: 'name' in badge ? badge.name : 'Unknown',
    })

    return successResponse({ badge: userBadge })
  }
)

// DELETE /api/admin/users/[id]/badges - Remove badge from user
export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    // Authenticate admin
    let userId: string
    try {
      userId = await getAuthUserId()
    } catch (authError) {
      logger.error('Authentication error in admin user badges DELETE', authError)
      return unauthorizedResponse(
        'Authentication failed',
        authError instanceof Error ? authError.message : 'Unauthorized'
      )
    }

    const supabase = createAdminClient()
    const { id } = await params

    // Check if requester is admin
    const { data: adminProfile, error: adminCheckError } = await safeEq(
      supabase
        .from('profiles')
        .select('is_admin'),
      'id',
      userId
    ).maybeSingle()

    if (adminCheckError || !(hasProperty(adminProfile, 'is_admin') && adminProfile.is_admin)) {
      return forbiddenResponse('Admin access required')
    }

    // Parse and validate request body
    const body = await safeJsonParse<unknown>(req)
    if (!body) {
      return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
    }

    const { badge_id } = validateRequest(BadgeRemoveSchema, body)

    // Get badge name for audit log
    const { data: badge, error: badgeError } = await safeEq(
      supabase
        .from('badges')
        .select('name'),
      'id',
      badge_id
    ).maybeSingle()

    if (badgeError) {
      logger.error('Failed to fetch badge', badgeError, { badge_id })
    }

    // Remove badge from user
    const { error } = await safeEq(
      safeEq(
        supabase
          .from('profile_badges')
          .delete(),
        'profile_id',
        id
      ),
      'badge_id',
      badge_id
    )

    if (error) {
      logger.error('Failed to remove badge from user', error, { userId: id, badgeId: badge_id })
      return internalErrorResponse('Failed to remove badge', error)
    }

    // Log audit trail (non-blocking)
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

    logger.info('Badge removed from user', {
      adminId: userId,
      userId: id,
      badgeId: badge_id,
      badgeName: badge && 'name' in badge ? badge.name : null,
    })

    return successResponse({ success: true })
  }
)
