// CLERK MIGRATION: API route for file uploads that bypasses RLS
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { getAuthUserId } from '@/lib/supabase-auth'
import { logger } from '@/lib/logger'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  internalErrorResponse,
  withErrorHandling,
} from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_BUCKETS = ['vendor-assets', 'vendor-docs', 'listings', 'avatars', 'posts', 'stories', 'store-banners'] as const
const ALLOWED_MIME_TYPES: Record<(typeof ALLOWED_BUCKETS)[number], readonly string[]> = {
  'vendor-assets': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'vendor-docs': ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  listings: ['image/jpeg', 'image/png', 'image/webp'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  posts: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
  stories: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
  'store-banners': ['image/jpeg', 'image/png', 'image/webp'],
}

/**
 * POST /api/upload
 * Upload a file to Supabase Storage
 * Uses service role key to bypass RLS policies
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  let userId: string
  try {
    userId = await getAuthUserId()
  } catch (authError) {
    return unauthorizedResponse(
      'Authentication failed. Please sign in to upload files.',
      authError instanceof Error ? authError.message : 'Unauthorized'
    )
  }

  // Rate limit check (authenticated write: 30/min)
  const rateLimitResponse = await rateLimit(req, { userId })
  if (rateLimitResponse) return rateLimitResponse

  const adminClient = createAdminClient()

  const formData = await req.formData()
  const file = formData.get('file')
  const bucket = formData.get('bucket')
  const path = formData.get('path')

  if (!(file instanceof File) || typeof bucket !== 'string' || typeof path !== 'string') {
    return errorResponse('Missing required fields: file, bucket, or path', 'MISSING_FIELDS')
  }

  // Validate bucket name (security: only allow specific buckets)
  if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
    return errorResponse('Invalid bucket name', 'INVALID_BUCKET')
  }

  const safeBucket = bucket as (typeof ALLOWED_BUCKETS)[number]
  if (!ALLOWED_MIME_TYPES[safeBucket].includes(file.type)) {
    return errorResponse('File type is not allowed for this upload destination', 'INVALID_FILE_TYPE')
  }

  // Validate file size (50MB limit for stories, 10MB for others)
  const maxSize = bucket === 'stories' ? 50 * 1024 * 1024 : 10 * 1024 * 1024 // 50MB for stories, 10MB for others
  if (file.size > maxSize) {
    return errorResponse(
      `File size exceeds ${bucket === 'stories' ? '50MB' : '10MB'} limit`,
      'FILE_TOO_LARGE'
    )
  }

  // Ensure path includes user ID for security (users can only upload to their own folders)
  // Add timestamp and random ID to make filename unique and prevent "resource already exists" errors
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 9)
  
  // Extract filename and extension from path
  const pathSegments = path.split('/')
  const filename = pathSegments[pathSegments.length - 1]
  if (!filename || pathSegments.some((segment) => segment === '..')) {
    return errorResponse('Invalid upload path', 'INVALID_PATH')
  }

  const filenameParts = filename.split('.')
  const hasExtension = filenameParts.length > 1
  
  let baseName: string
  let extension: string
  
  if (hasExtension) {
    extension = `.${filenameParts.pop()}`
    baseName = filenameParts.join('.')
  } else {
    extension = ''
    baseName = filename
  }
  
  // Create unique filename: baseName-timestamp-randomId.extension
  const uniqueFilename = `${baseName}-${timestamp}-${randomId}${extension}`
  
  // Build user path: userId/.../uniqueFilename
  pathSegments[pathSegments.length - 1] = uniqueFilename
  const userPath = path.startsWith(userId)
    ? pathSegments.join('/')
    : `${userId}/${pathSegments.join('/')}`

  // Convert File to ArrayBuffer for upload
  // In Node.js, we need to convert to Uint8Array for Supabase
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  // Upload file using admin client (bypasses RLS)
  // Use upsert: true to allow overwriting if somehow the same unique path exists
  const { data, error } = await adminClient.storage
    .from(safeBucket)
    .upload(userPath, uint8Array, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true, // Allow overwriting (shouldn't happen with unique paths, but safe fallback)
    })

  if (error) {
    logger.error('File upload error', error, { bucket, path: userPath, userId })
    return internalErrorResponse('Failed to upload file', error)
  }

  if (!data) {
    return internalErrorResponse('Upload failed - no data returned')
  }

  // Get public URL
  const { data: { publicUrl } } = adminClient.storage
    .from(bucket)
    .getPublicUrl(data.path)

  // For private buckets, return the path instead (will need signed URLs for access)
  const isPrivateBucket = bucket === 'vendor-docs'
  const url = isPrivateBucket ? data.path : publicUrl

  return successResponse({
    path: data.path,
    url: url,
    publicUrl: publicUrl,
  })
})

