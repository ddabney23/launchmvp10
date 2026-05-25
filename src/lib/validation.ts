/**
 * API Validation Schemas
 * Zod schemas for request validation across all API routes
 */

import { z } from 'zod'

// ============= Posts Schemas =============

export const createPostSchema = z.object({
  content: z.string()
    .min(1, 'Post content is required')
    .max(5000, 'Post content too long (max 5000 characters)')
    .transform(val => val.trim()),
  content_type: z.enum(['text', 'image', 'video', 'link']).default('text'),
  hashtags: z.array(z.string().max(50)).max(10).optional(),
  mentions: z.array(z.string().uuid()).max(20).optional(),
  location: z.string().max(200).nullable().optional(),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    caption: z.string().max(500).optional(),
  })).max(10).optional(),
})

export const updatePostSchema = z.object({
  content: z.string()
    .min(1, 'Post content cannot be empty')
    .max(5000, 'Post content too long (max 5000 characters)')
    .transform(val => val.trim())
    .optional(),
  hashtags: z.array(z.string().max(50)).max(10).optional(),
  mentions: z.array(z.string().uuid()).max(20).optional(),
  location: z.string().max(200).nullable().optional(),
})

export const getPostsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  user_id: z.string().uuid().optional(),
  type: z.enum(['text', 'image', 'video', 'link']).optional(),
})

// ============= Comments Schemas =============

export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment too long (max 2000 characters)')
    .transform(val => val.trim()),
  parent_comment_id: z.string().uuid().nullable().optional(),
})

export const getCommentsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// ============= Follow Schemas =============

export const getFollowSchema = z.object({
  type: z.enum(['followers', 'following']).default('followers'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// ============= Notifications Schemas =============

export const getNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  unread: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
})

// ============= Upload Schemas =============

export const uploadFileSchema = z.object({
  bucket: z.enum(['avatars', 'images', 'videos', 'documents']),
  path: z.string().max(500),
  file: z.instanceof(File),
})

// ============= Booking Schemas =============

export const createBookingSchema = z.object({
  listing_id: z.string().uuid('Invalid listing ID'),
  start_date: z.string().datetime('Invalid start date format'),
  end_date: z.string().datetime('Invalid end date format'),
  total_price: z.number().positive('Price must be positive'),
  notes: z.string().max(1000).optional(),
}).refine(
  data => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
).refine(
  data => new Date(data.start_date) > new Date(),
  { message: 'Start date must be in the future', path: ['start_date'] }
)

export const updateBookingSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  cancellation_reason: z.string().max(500).optional(),
})

// ============= Payment Schemas =============

export const createPaymentIntentSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(999999, 'Amount too large'),
  currency: z.string().length(3, 'Currency must be 3 letters').default('usd'),
  order_id: z.string().uuid('Invalid order ID').optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

// ============= Admin Schemas =============

export const searchUsersSchema = z.object({
  q: z.string().max(200).optional(),
  role: z.enum(['vendor', 'customer', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

export const exportUsersSchema = z.object({
  role: z.enum(['vendor', 'customer', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
})

export const updateUserRoleSchema = z.object({
  is_admin: z.boolean().optional(),
  is_vendor: z.boolean().optional(),
  vendor_verified: z.boolean().optional(),
  account_status: z.enum(['active', 'suspended', 'banned']).optional(),
})

export const assignBadgeSchema = z.object({
  badge_id: z.string().uuid('Invalid badge ID'),
  reason: z.string().max(500).optional(),
})

// ============= Gamification Schemas =============

export const updateGamificationSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  action: z.enum([
    'post_created',
    'comment_added',
    'listing_created',
    'order_completed',
    'profile_completed',
    'referral',
    'custom'
  ]),
  points: z.number().int().min(-1000).max(1000).optional(),
  custom_points: z.number().int().min(-1000).max(1000).optional(),
})

// ============= Vendor Schemas =============

export const verifyVendorSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  verified: z.boolean(),
  reason: z.string().max(500).optional(),
})

// ============= Helper Functions =============

/**
 * Validate request body against schema
 * Returns validated data or throws with formatted errors
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    const errors = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }))
    
    throw new ValidationError('Validation failed', errors)
  }
  
  return result.data
}

/**
 * Validate URL search params against schema
 */
export function validateSearchParams<T>(schema: z.ZodSchema<T>, params: URLSearchParams): T {
  const data = Object.fromEntries(params.entries())
  return validateRequest(schema, data)
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize text input (remove control characters, trim)
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .trim()
}

/**
 * Validate and sanitize user input
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  const sanitized = sanitizeText(input)
  
  if (sanitized.length > maxLength) {
    throw new ValidationError('Input too long', [{
      field: 'input',
      message: `Maximum length is ${maxLength} characters`,
    }])
  }
  
  return sanitized
}
