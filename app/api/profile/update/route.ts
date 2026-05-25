import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId, getAuthUser } from '@/lib/supabase-auth'
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
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ProfileUpdateSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  is_vendor: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
  credits: z.number().min(0).optional(),
  store_name: z.string().max(200).optional(),
  store_description: z.string().max(2000).nullable().optional(),
  store_banner_url: z.string().url().nullable().optional(),
  store_policies: z.record(z.any()).nullable().optional(),
  store_hours: z.record(z.any()).nullable().optional(),
  store_location: z.string().max(200).nullable().optional(),
  store_social_links: z.record(z.string()).nullable().optional(),
}).passthrough()

export const PUT = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  let user: Awaited<ReturnType<typeof getAuthUser>>

  try {
    userId = await getAuthUserId()
    user = await getAuthUser()
  } catch (authError) {
    logger.error('Authentication error in profile update', authError)
    return unauthorizedResponse(
      'Authentication failed',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  const rateLimitResponse = await strictRateLimit(req, userId)
  if (rateLimitResponse) return rateLimitResponse

  const body = await safeJsonParse<unknown>(req)
  if (!body) {
    return errorResponse('Invalid request body', 'PARSE_ERROR', 'Failed to parse JSON request body')
  }

  const validationResult = ProfileUpdateSchema.safeParse(body)
  if (!validationResult.success) {
    return validationErrorResponse(validationResult.error.errors)
  }

  const updates = validationResult.data
  const adminClient = createAdminClient()

  const { data: existingProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, username')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    logger.error('Failed to fetch profile', profileError, { userId })
    return internalErrorResponse('Failed to fetch user profile', profileError)
  }

  if (!existingProfile) {
    const email = user?.email || ''
    const emailPrefix = email.split('@')[0] || `user_${Date.now()}`

    const newProfileData: Record<string, unknown> = {
      id: userId,
      username: updates.username || updates.display_name || emailPrefix,
      display_name:
        updates.display_name ||
        (user?.user_metadata?.display_name as string) ||
        emailPrefix,
      email,
      avatar_url:
        updates.avatar_url ||
        (user?.user_metadata?.avatar_url as string) ||
        null,
      bio: updates.bio ?? null,
      is_vendor: updates.is_vendor ?? false,
      vendor_verified: false,
      onboarding_completed: updates.onboarding_completed ?? false,
      credits: updates.credits ?? 0,
      ...updates,
    }

    if (!updates.username) {
      let username = String(newProfileData.username)
      let attempts = 0
      while (attempts < 5) {
        const { data: existing } = await adminClient
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle()

        if (!existing) break
        username = `${emailPrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`
        attempts++
      }
      newProfileData.username = username
    }

    const { data: created, error: createError } = await adminClient
      .from('profiles')
      .insert(newProfileData)
      .select('*')
      .single()

    if (createError || !created) {
      logger.error('Failed to create profile', createError, { userId })
      return internalErrorResponse('Failed to create user profile', createError)
    }

    return successResponse(created, 'Profile created successfully')
  }

  const { data: updated, error: updateError } = await adminClient
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('*')
    .single()

  if (updateError) {
    if (updateError.code === '23505') {
      return errorResponse(
        'Username is already taken',
        'USERNAME_TAKEN',
        'Please choose a different username'
      )
    }
    logger.error('Failed to update profile', updateError, { userId })
    return internalErrorResponse('Failed to update profile', updateError)
  }

  return successResponse(updated, 'Profile updated successfully')
})
