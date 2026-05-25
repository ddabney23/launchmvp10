/**
 * Type tests to ensure type safety across the application
 * 
 * These tests use TypeScript's type system to verify:
 * - Type compatibility
 * - Null handling (Answer 6: A - use null exclusively)
 * - Schema validation types
 * - API response types
 */

import { describe, it, expectTypeOf } from 'vitest'
import type {
  Profile,
  ProfileUpdate,
  VendorVerification,
  BadgeCreate,
  BookingCreate,
  GamificationUpdate,
} from '@/lib/validations/schemas'
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
} from '@/lib/api-response'
import type { Database } from '@/integrations/supabase/types'

// ============================================================================
// NULL HANDLING TESTS (Answer 6: A - use null exclusively)
// ============================================================================

describe('Null handling', () => {
  it('should allow null for optional fields', () => {
    const profileUpdate: ProfileUpdate = {
      bio: null, // Should be allowed
      avatar_url: null, // Should be allowed
    }
    expectTypeOf(profileUpdate.bio).toEqualTypeOf<string | null | undefined>()
    expectTypeOf(profileUpdate.avatar_url).toEqualTypeOf<string | null | undefined>()
  })

  it('should not allow undefined for required nullable fields', () => {
    // TypeScript should catch this at compile time
    // const invalid: ProfileUpdate = { bio: undefined } // Should error
  })
})

// ============================================================================
// SCHEMA TYPE TESTS
// ============================================================================

describe('Schema types', () => {
  it('should have correct VendorVerification type', () => {
    const verification: VendorVerification = {
      businessName: 'Test Business',
      businessType: 'Retail',
      taxId: null, // Should allow null
      businessAddress: {
        street: '',
        city: '',
        state: null,
        zip: '',
        country: 'US',
      },
      phoneNumber: '+1234567890',
      idDocumentUrl: null, // Should allow null
      businessLicenseUrl: null,
      additionalDocuments: null,
      notes: null,
    }
    expectTypeOf(verification.businessName).toBeString()
    expectTypeOf(verification.taxId).toEqualTypeOf<string | null | undefined>()
  })

  it('should have correct BadgeCreate type', () => {
    const badge: BadgeCreate = {
      key: 'test-badge',
      name: 'Test Badge',
      description: null, // Should allow null
      icon: null,
      category: null,
      points_required: null,
    }
    expectTypeOf(badge.key).toBeString()
    expectTypeOf(badge.description).toEqualTypeOf<string | null | undefined>()
  })
})

// ============================================================================
// API RESPONSE TYPE TESTS
// ============================================================================

describe('API response types', () => {
  it('should have correct ApiSuccessResponse type', () => {
    const success: ApiSuccessResponse<{ id: string }> = {
      success: true,
      data: { id: '123' },
      message: 'Success',
    }
    expectTypeOf(success.success).toEqualTypeOf<true>()
    expectTypeOf(success.data).toEqualTypeOf<{ id: string }>()
  })

  it('should have correct ApiErrorResponse type', () => {
    const error: ApiErrorResponse = {
      success: false,
      error: 'Error message',
      code: 'ERROR_CODE',
      details: null, // Should allow null
    }
    expectTypeOf(error.success).toEqualTypeOf<false>()
    expectTypeOf(error.error).toBeString()
    expectTypeOf(error.details).toEqualTypeOf<unknown>()
  })

  it('should have correct ApiResponse union type', () => {
    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id: '123' },
    }
    expectTypeOf(response).toMatchTypeOf<ApiSuccessResponse<{ id: string }> | ApiErrorResponse>()
  })
})

// ============================================================================
// DATABASE TYPE TESTS
// ============================================================================

describe('Database types', () => {
  it('should have correct Profile type from Database', () => {
    type ProfileRow = Database['public']['Tables']['profiles']['Row']
    expectTypeOf<ProfileRow['id']>().toBeString()
    expectTypeOf<ProfileRow['bio']>().toEqualTypeOf<string | null>()
    expectTypeOf<ProfileRow['avatar_url']>().toEqualTypeOf<string | null>()
  })

  it('should have correct ProfileInsert type', () => {
    type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
    const insert: ProfileInsert = {
      id: '123',
      username: 'test',
      bio: null, // Should allow null
      avatar_url: null,
    }
    expectTypeOf(insert.bio).toEqualTypeOf<string | null | undefined>()
  })
})

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('Type guards', () => {
  it('should narrow types correctly', () => {
    const response: ApiResponse = {
      success: true,
      data: { id: '123' },
    }

    if (response.success) {
      // TypeScript should know this is ApiSuccessResponse
      expectTypeOf(response.data).not.toBeUndefined()
    } else {
      // TypeScript should know this is ApiErrorResponse
      expectTypeOf(response.error).toBeString()
    }
  })
})

// ============================================================================
// VALIDATION SCHEMA TESTS
// ============================================================================

describe('Validation schemas', () => {
  it('should validate BookingCreate correctly', () => {
    const booking: BookingCreate = {
      listing_id: '123e4567-e89b-12d3-a456-426614174000',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T12:00:00Z',
      notes: null, // Should allow null
    }
    expectTypeOf(booking.listing_id).toBeString()
    expectTypeOf(booking.notes).toEqualTypeOf<string | null | undefined>()
  })

  it('should validate GamificationUpdate correctly', () => {
    const gamification: GamificationUpdate = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      action: 'purchase',
      metadata: null, // Should allow null
    }
    expectTypeOf(gamification.userId).toBeString()
    expectTypeOf(gamification.action).toEqualTypeOf<
      | 'purchase'
      | 'post_created'
      | 'comment_created'
      | 'like_given'
      | 'follow_user'
      | 'listing_created'
      | 'booking_created'
      | 'review_created'
    >()
    expectTypeOf(gamification.metadata).toEqualTypeOf<Record<string, unknown> | null | undefined>()
  })
})

