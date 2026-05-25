/**
 * Centralized Zod validation schemas for all API routes
 * 
 * All schemas follow these principles:
 * - Use null exclusively (Answer 6: A)
 * - Maximum type safety
 * - Consistent validation rules
 */

import { z } from 'zod'

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * UUID validation
 */
export const UuidSchema = z.string().uuid()

/**
 * Email validation
 */
export const EmailSchema = z.string().email()

/**
 * URL validation (allows empty string and null)
 */
export const UrlSchema = z.union([z.string().url(), z.literal(''), z.null()]).optional().nullable()

/**
 * Phone number validation (E.164 format)
 */
export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/).optional()

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

/**
 * Sort order schema
 */
export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc')

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

export const ProfileUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: UrlSchema,
  email: EmailSchema.optional(),
  phone: PhoneSchema.nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  school: z.string().max(200).optional().nullable(),
  is_vendor: z.boolean().optional(),
  vendor_verified: z.boolean().optional(),
  is_admin: z.boolean().optional(),
  points: z.number().int().nonnegative().optional(),
  credits: z.number().nonnegative().optional(),
  account_status: z.enum(['active', 'suspended', 'banned']).optional(),
  admin_notes: z.string().max(1000).optional().nullable(),
})

// ============================================================================
// VENDOR SCHEMAS
// ============================================================================

export const VendorVerificationSchema = z.object({
  businessName: z.string().min(2).max(200),
  businessType: z.string().min(2).max(100),
  taxId: z.string().optional().nullable(),
  businessAddress: z.object({
    street: z.string().optional().default(''),
    city: z.string().optional().default(''),
    state: z.string().optional().nullable(),
    zip: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }).optional().default({}),
  phoneNumber: PhoneSchema.default('+1234567890'),
  idDocumentUrl: UrlSchema.optional().nullable(),
  businessLicenseUrl: UrlSchema.optional().nullable(),
  additionalDocuments: z.array(z.string().url()).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const VendorApplicationActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
  message: z.string().max(1000).optional().nullable(),
})

// ============================================================================
// BADGE SCHEMAS
// ============================================================================

export const BadgeCreateSchema = z.object({
  key: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  points_required: z.number().int().nonnegative().optional().nullable(),
})

export const BadgeUpdateSchema = BadgeCreateSchema.partial()

export const BadgeAssignSchema = z.object({
  badge_id: UuidSchema,
})

export const BadgeRemoveSchema = z.object({
  badge_id: UuidSchema,
})

// ============================================================================
// BOOKING SCHEMAS
// ============================================================================

export const BookingCreateSchema = z.object({
  listing_id: UuidSchema,
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
})

export const BookingUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'canceled', 'completed']).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  notes: z.string().max(1000).optional().nullable(),
})

// ============================================================================
// GAMIFICATION SCHEMAS
// ============================================================================

export const GamificationActionSchema = z.enum([
  'purchase',
  'post_created',
  'comment_created',
  'like_given',
  'follow_user',
  'listing_created',
  'booking_created',
  'review_created',
])

export const GamificationUpdateSchema = z.object({
  userId: UuidSchema,
  action: GamificationActionSchema,
  metadata: z.record(z.unknown()).optional().nullable(),
})

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const PaymentIntentCreateSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  listing_id: UuidSchema.optional(),
  order_id: UuidSchema.optional(),
  metadata: z.record(z.string()).optional().nullable(),
})

// ============================================================================
// LISTING SCHEMAS
// ============================================================================

export const ListingCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
  category: z.string().min(1).max(100),
  quantity: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  images: z.array(z.string().url()).optional().nullable(),
})

export const ListingUpdateSchema = ListingCreateSchema.partial()

// ============================================================================
// POST SCHEMAS
// ============================================================================

export const PostCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  media_urls: z.array(z.string().url()).optional().nullable(),
  visibility: z.enum(['public', 'private', 'followers']).default('public'),
  mentions: z.array(UuidSchema).max(20).optional(),
})

export const PostUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  media_urls: z.array(z.string().url()).optional().nullable(),
  visibility: z.enum(['public', 'private', 'followers']).optional(),
})

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

export const CommentCreateSchema = z.object({
  post_id: UuidSchema,
  content: z.string().min(1).max(1000),
  parent_id: UuidSchema.optional().nullable(),
  mentions: z.array(UuidSchema).max(20).optional(),
})

// ============================================================================
// USER SEARCH SCHEMAS
// ============================================================================

export const UserSearchSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  role: z.enum(['vendor', 'admin', 'regular']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

// ============================================================================
// EXPORT SCHEMAS
// ============================================================================

export const ExportFormatSchema = z.enum(['csv', 'json'])

export const UserExportSchema = z.object({
  format: ExportFormatSchema,
  filters: UserSearchSchema.optional(),
})

// ============================================================================
// UPLOAD SCHEMAS
// ============================================================================

export const AllowedBucketSchema = z.enum([
  'vendor-assets',
  'vendor-docs',
  'listings',
  'avatars',
  'posts',
])

export const FileUploadSchema = z.object({
  bucket: AllowedBucketSchema,
  path: z.string().min(1).max(500),
  file: z.instanceof(File),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>
export type VendorVerification = z.infer<typeof VendorVerificationSchema>
export type VendorApplicationAction = z.infer<typeof VendorApplicationActionSchema>
export type BadgeCreate = z.infer<typeof BadgeCreateSchema>
export type BadgeUpdate = z.infer<typeof BadgeUpdateSchema>
export type BadgeAssign = z.infer<typeof BadgeAssignSchema>
export type BookingCreate = z.infer<typeof BookingCreateSchema>
export type BookingUpdate = z.infer<typeof BookingUpdateSchema>
export type GamificationUpdate = z.infer<typeof GamificationUpdateSchema>
export type PaymentIntentCreate = z.infer<typeof PaymentIntentCreateSchema>
export type ListingCreate = z.infer<typeof ListingCreateSchema>
export type ListingUpdate = z.infer<typeof ListingUpdateSchema>
export type PostCreate = z.infer<typeof PostCreateSchema>
export type PostUpdate = z.infer<typeof PostUpdateSchema>
export type CommentCreate = z.infer<typeof CommentCreateSchema>
export type UserSearch = z.infer<typeof UserSearchSchema>
export type UserExport = z.infer<typeof UserExportSchema>
export type FileUpload = z.infer<typeof FileUploadSchema>

