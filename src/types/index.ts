/**
 * Shared TypeScript types for the application
 * 
 * This file contains all domain models, API response types, and utility types
 * used across the application to ensure type safety.
 */

import { Database } from '@/integrations/supabase/types'

// ============================================================================
// DATABASE TYPES - Extract types from Supabase schema
// ============================================================================

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type VendorProfile = Database['public']['Tables']['vendor_profiles']['Row']
export type VendorProfileInsert = Database['public']['Tables']['vendor_profiles']['Insert']
export type VendorProfileUpdate = Database['public']['Tables']['vendor_profiles']['Update']

// VendorApplication table doesn't exist in current schema
// export type VendorApplication = Database['public']['Tables']['vendor_applications']['Row']
// export type VendorApplicationInsert = Database['public']['Tables']['vendor_applications']['Insert']
// export type VendorApplicationUpdate = Database['public']['Tables']['vendor_applications']['Update']

export type Badge = Database['public']['Tables']['badges']['Row']
export type BadgeInsert = Database['public']['Tables']['badges']['Insert']
export type BadgeUpdate = Database['public']['Tables']['badges']['Update']

export type UserBadge = Database['public']['Tables']['user_badges']['Row']
export type UserBadgeInsert = Database['public']['Tables']['user_badges']['Insert']
export type UserBadgeUpdate = Database['public']['Tables']['user_badges']['Update']

// AuditLog table doesn't exist in current schema  
// export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
// export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

export type Post = Database['public']['Tables']['posts']['Row']
export type Listing = Database['public']['Tables']['listings']['Row']
export type Order = Database['public']['Tables']['orders']['Row']

// ============================================================================
// DOMAIN MODELS - Extended types with relationships
// ============================================================================

/**
 * Profile with vendor information included
 */
export interface ProfileWithVendor extends Profile {
  vendor_profile?: VendorProfile | null
}

/**
 * User badge with badge details
 */
export interface UserBadgeWithDetails extends Omit<UserBadge, 'badge_id'> {
  badge: Badge
}

/**
 * Profile with statistics
 */
export interface ProfileWithStats extends ProfileWithVendor {
  stats: UserStats
  recent_posts?: Post[]
  // vendor_application field removed - table doesn't exist in schema
}

/**
 * User statistics
 */
export interface UserStats {
  posts_count: number
  listings_count: number
  orders_count: number
  followers_count: number
  following_count: number
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success?: boolean
  data?: T
  message?: string
  [key: string]: unknown
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: string
  code?: string
  field?: string
  details?: unknown
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Admin user search response
 */
export interface AdminUserSearchResponse {
  users: Profile[]
  total: number
  page: number
  limit: number
}

/**
 * Admin user detail response
 */
export interface AdminUserDetailResponse {
  profile: ProfileWithVendor
  stats: UserStats
  recent_posts: Post[]
  // vendor_application field removed - table doesn't exist in schema
}

/**
 * Badge management response
 */
export interface BadgeListResponse {
  badges: UserBadgeWithDetails[]
}

/**
 * Badge operation response
 */
export interface BadgeOperationResponse {
  success: boolean
  badge?: UserBadgeWithDetails
  message?: string
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * User profile update request
 */
export interface UserUpdateRequest {
  username?: string
  display_name?: string
  bio?: string | null
  avatar_url?: string | null
  email?: string
  phone?: string | null
  city?: string | null
  state?: string | null
  school?: string | null
  is_vendor?: boolean
  vendor_verified?: boolean
  is_admin?: boolean
  points?: number
  credits?: number
  reputation_score?: number
  account_status?: 'active' | 'suspended' | 'banned'
  admin_notes?: string | null
}

/**
 * User role update request
 */
export interface UserRoleUpdateRequest {
  is_vendor?: boolean
  vendor_verified?: boolean
  is_admin?: boolean
}

/**
 * Badge assignment request
 */
export interface BadgeAssignRequest {
  badge_id: string
}

/**
 * User search filters
 */
export interface UserSearchFilters {
  query?: string
  role?: 'vendor' | 'admin' | 'regular'
  status?: 'active' | 'suspended' | 'banned'
  page?: number
  limit?: number
}

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json'

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Make specific properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Non-nullable type helper
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * Extract non-null fields from type
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>
}

/**
 * Supabase query result type helper
 */
export type SupabaseQueryResult<T> = {
  data: T | null
  error: Error | null
}

/**
 * Supabase query array result
 */
export type SupabaseQueryArrayResult<T> = {
  data: T[] | null
  error: Error | null
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if profile has admin role
 */
export function isAdmin(profile: Profile | null | undefined): profile is Profile & { is_admin: true } {
  return profile?.is_admin === true
}

/**
 * Check if profile is a vendor
 */
export function isVendor(profile: Profile | null | undefined): profile is Profile & { is_vendor: true } {
  return profile?.is_vendor === true
}

/**
 * Check if profile is a verified vendor
 */
export function isVerifiedVendor(
  profile: Profile | null | undefined
): profile is Profile & { is_vendor: true; vendor_verified: true } {
  return profile?.is_vendor === true && profile?.vendor_verified === true
}

/**
 * Check if account is active (account_status field doesn't exist in current schema)
 */
export function isActiveAccount(
  profile: Profile | null | undefined
): boolean {
  // Simply check if profile exists since account_status isn't in schema
  return !!profile
}

/**
 * Type guard for checking if error is Supabase error
 */
export function isSupabaseError(error: unknown): error is { code: string; message: string; details?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

/**
 * Type guard for API error response
 */
export function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as { error: unknown }).error === 'string'
  )
}

/**
 * Type guard for checking if value is defined (not null/undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Type guard for non-empty array
 */
export function isNonEmptyArray<T>(arr: T[] | null | undefined): arr is [T, ...T[]] {
  return Array.isArray(arr) && arr.length > 0
}

/**
 * Type guard for Profile
 */
export function isProfile(value: unknown): value is Profile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'username' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { username: unknown }).username === 'string' &&
    'is_vendor' in value &&
    typeof (value as { is_vendor: unknown }).is_vendor === 'boolean'
  )
}

/**
 * Type guard for VendorProfile
 */
export function isVendorProfile(value: unknown): value is VendorProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'user_id' in value &&
    'business_name' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { user_id: unknown }).user_id === 'string' &&
    typeof (value as { business_name: unknown }).business_name === 'string'
  )
}

/**
 * Type guard for ProfileWithVendor
 */
export function isProfileWithVendor(value: unknown): value is ProfileWithVendor {
  if (!isProfile(value)) return false
  const profile = value as ProfileWithVendor
  return (
    !('vendor_profile' in profile) ||
    profile.vendor_profile === null ||
    profile.vendor_profile === undefined ||
    isVendorProfile(profile.vendor_profile)
  )
}

/**
 * Type guard for valid Post
 */
export function isValidPost(value: unknown): value is Post {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'author' in value &&
    'content' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { author: unknown }).author === 'string' &&
    typeof (value as { content: unknown }).content === 'string' &&
    (value as { content: string }).content.length > 0
  )
}

/**
 * Type guard for valid Listing
 */
export function isValidListing(value: unknown): value is Listing {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'vendor' in value &&
    'title' in value &&
    'price' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { vendor: unknown }).vendor === 'string' &&
    typeof (value as { title: unknown }).title === 'string' &&
    typeof (value as { price: unknown }).price === 'number' &&
    (value as { price: number }).price >= 0 &&
    'active' in value &&
    typeof (value as { active: unknown }).active === 'boolean'
  )
}

/**
 * Type guard for valid Order
 */
export function isValidOrder(value: unknown): value is Order {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'buyer' in value &&
    'total_amount' in value &&
    'status' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { buyer: unknown }).buyer === 'string' &&
    typeof (value as { total_amount: unknown }).total_amount === 'number' &&
    (value as { total_amount: number }).total_amount >= 0 &&
    typeof (value as { status: unknown }).status === 'string' &&
    ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(
      (value as { status: string }).status
    )
  )
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Account status enum
 */
export const AccountStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
} as const

export type AccountStatusType = (typeof AccountStatus)[keyof typeof AccountStatus]

/**
 * User roles
 */
export const UserRole = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  REGULAR: 'regular',
} as const

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole]

/**
 * Vendor application status
 */
export const VendorApplicationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const

export type VendorApplicationStatusType = (typeof VendorApplicationStatus)[keyof typeof VendorApplicationStatus]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Assert value is defined, throw if not
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message || 'Value is null or undefined')
  }
}

/**
 * Safe JSON parse with type checking
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    const parsed = JSON.parse(json)
    return parsed as T
  } catch {
    return defaultValue
  }
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (isSupabaseError(error)) return error.message
  if (isApiErrorResponse(error)) return error.error
  return 'An unknown error occurred'
}
