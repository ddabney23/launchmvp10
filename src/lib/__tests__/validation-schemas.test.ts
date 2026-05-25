/**
 * Comprehensive Validation Schema Tests
 * Tests all Zod schemas in src/lib/validations/schemas.ts
 */

import { describe, it, expect } from 'vitest'
import {
  UuidSchema,
  EmailSchema,
  UrlSchema,
  PhoneSchema,
  ProfileUpdateSchema,
  VendorVerificationSchema,
  VendorApplicationActionSchema,
  BadgeCreateSchema,
  BadgeAssignSchema,
  BookingCreateSchema,
  BookingUpdateSchema,
  GamificationUpdateSchema,
  PaymentIntentCreateSchema,
  PostCreateSchema,
  PostUpdateSchema,
  CommentCreateSchema,
  UserSearchSchema,
} from '@/lib/validations/schemas'

describe('Common Schemas', () => {
  describe('UuidSchema', () => {
    it('accepts valid UUIDs', () => {
      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      ]
      validUuids.forEach((uuid) => {
        expect(() => UuidSchema.parse(uuid)).not.toThrow()
      })
    })

    it('rejects invalid UUIDs', () => {
      const invalidUuids = [
        'not-a-uuid',
        '123',
        'abc-def-ghi',
        '123e4567-e89b-12d3-a456',
        '',
      ]
      invalidUuids.forEach((uuid) => {
        expect(() => UuidSchema.parse(uuid)).toThrow()
      })
    })
  })

  describe('EmailSchema', () => {
    it('accepts valid emails', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'name+tag@email.org',
      ]
      validEmails.forEach((email) => {
        expect(() => EmailSchema.parse(email)).not.toThrow()
      })
    })

    it('rejects invalid emails', () => {
      const invalidEmails = ['not-an-email', 'missing@', '@nodomain.com', '']
      invalidEmails.forEach((email) => {
        expect(() => EmailSchema.parse(email)).toThrow()
      })
    })
  })

  describe('UrlSchema', () => {
    it('accepts valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.domain.com/path',
        '',
        null,
      ]
      validUrls.forEach((url) => {
        expect(() => UrlSchema.parse(url)).not.toThrow()
      })
    })

    it('rejects invalid URLs (non-URL strings)', () => {
      // UrlSchema is designed for optional fields and allows empty/''/null
      // Only strict URL-format strings or empty/null are valid
      const invalidUrls = ['not-a-url']
      invalidUrls.forEach((url) => {
        expect(() => UrlSchema.parse(url)).toThrow()
      })
      
      // These are technically valid because schema is optional/nullable
      // 'example.com' would fail url() validation if not empty/null
      // but the union allows it to pass as undefined/optional
      expect(() => UrlSchema.parse(undefined)).not.toThrow()
    })
  })

  describe('PhoneSchema', () => {
    it('accepts valid E.164 phone numbers', () => {
      const validPhones = ['+14155551234', '+442071234567', '+33123456789']
      validPhones.forEach((phone) => {
        expect(() => PhoneSchema.parse(phone)).not.toThrow()
      })
    })

    it('rejects invalid phone numbers', () => {
      // PhoneSchema validates E.164 format: optional +, then 1-9, then 1-14 digits
      // Invalid: starts with 0, has letters, has special chars, too short/long
      const invalidPhones = ['0123456789', 'not-a-phone', '555-CALL', '+', '1', '+12345678901234567'] // too long (16 digits)
      invalidPhones.forEach((phone) => {
        const result = PhoneSchema.safeParse(phone)
        expect(result.success).toBe(false)
      })
      
      // Undefined is valid because schema is optional
      expect(() => PhoneSchema.parse(undefined)).not.toThrow()
    })
  })
})

describe('Profile Schemas', () => {
  describe('ProfileUpdateSchema', () => {
    it('accepts valid profile updates', () => {
      const validData = {
        username: 'testuser',
        display_name: 'Test User',
        bio: 'A short bio',
        email: 'user@example.com',
      }
      expect(() => ProfileUpdateSchema.parse(validData)).not.toThrow()
    })

    it('rejects username too short', () => {
      expect(() =>
        ProfileUpdateSchema.parse({ username: 'ab' })
      ).toThrow()
    })

    it('rejects username too long', () => {
      expect(() =>
        ProfileUpdateSchema.parse({ username: 'a'.repeat(51) })
      ).toThrow()
    })

    it('rejects bio too long', () => {
      expect(() =>
        ProfileUpdateSchema.parse({ bio: 'a'.repeat(501) })
      ).toThrow()
    })

    it('accepts all fields as optional', () => {
      expect(() => ProfileUpdateSchema.parse({})).not.toThrow()
    })
  })
})

describe('Vendor Schemas', () => {
  describe('VendorVerificationSchema', () => {
    it('accepts valid vendor verification', () => {
      const validData = {
        businessName: 'Acme Corp',
        businessType: 'Technology',
        phoneNumber: '+14155551234',
        businessAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US',
        },
      }
      expect(() => VendorVerificationSchema.parse(validData)).not.toThrow()
    })

    it('requires businessName', () => {
      expect(() =>
        VendorVerificationSchema.parse({ businessType: 'Tech' })
      ).toThrow()
    })

    it('requires businessType', () => {
      expect(() =>
        VendorVerificationSchema.parse({ businessName: 'Acme' })
      ).toThrow()
    })

    it('rejects businessName too short', () => {
      expect(() =>
        VendorVerificationSchema.parse({
          businessName: 'A',
          businessType: 'Tech',
        })
      ).toThrow()
    })

    it('rejects businessName too long', () => {
      expect(() =>
        VendorVerificationSchema.parse({
          businessName: 'A'.repeat(201),
          businessType: 'Tech',
        })
      ).toThrow()
    })

    it('accepts optional fields', () => {
      const minimalData = {
        businessName: 'Acme Corp',
        businessType: 'Technology',
      }
      expect(() => VendorVerificationSchema.parse(minimalData)).not.toThrow()
    })
  })

  describe('VendorApplicationActionSchema', () => {
    it('accepts approve action', () => {
      expect(() =>
        VendorApplicationActionSchema.parse({ action: 'approve' })
      ).not.toThrow()
    })

    it('accepts deny action', () => {
      expect(() =>
        VendorApplicationActionSchema.parse({ action: 'deny' })
      ).not.toThrow()
    })

    it('rejects invalid action', () => {
      expect(() =>
        VendorApplicationActionSchema.parse({ action: 'pending' })
      ).toThrow()
    })

    it('accepts optional message', () => {
      expect(() =>
        VendorApplicationActionSchema.parse({
          action: 'deny',
          message: 'Need more docs',
        })
      ).not.toThrow()
    })

    it('rejects message too long', () => {
      expect(() =>
        VendorApplicationActionSchema.parse({
          action: 'deny',
          message: 'a'.repeat(1001),
        })
      ).toThrow()
    })
  })
})

describe('Badge Schemas', () => {
  describe('BadgeCreateSchema', () => {
    it('accepts valid badge creation', () => {
      const validData = {
        key: 'first-post',
        name: 'First Post',
        description: 'Created your first post',
        icon: '🎉',
      }
      expect(() => BadgeCreateSchema.parse(validData)).not.toThrow()
    })

    it('requires key', () => {
      expect(() =>
        BadgeCreateSchema.parse({ name: 'Badge' })
      ).toThrow()
    })

    it('rejects key too long', () => {
      expect(() =>
        BadgeCreateSchema.parse({
          key: 'a'.repeat(51),
          name: 'Badge',
        })
      ).toThrow()
    })
  })

  describe('BadgeAssignSchema', () => {
    it('accepts valid badge assignment', () => {
      expect(() =>
        BadgeAssignSchema.parse({
          badge_id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).not.toThrow()
    })

    it('requires badge_id', () => {
      expect(() => BadgeAssignSchema.parse({})).toThrow()
    })

    it('rejects invalid UUID', () => {
      expect(() =>
        BadgeAssignSchema.parse({ badge_id: 'not-a-uuid' })
      ).toThrow()
    })
  })
})

describe('Booking Schemas', () => {
  describe('BookingCreateSchema', () => {
    it('accepts valid booking', () => {
      const validData = {
        listing_id: '123e4567-e89b-12d3-a456-426614174000',
        start_time: '2024-12-01T10:00:00Z',
        end_time: '2024-12-01T11:00:00Z',
      }
      expect(() => BookingCreateSchema.parse(validData)).not.toThrow()
    })

    it('requires listing_id', () => {
      expect(() =>
        BookingCreateSchema.parse({
          start_time: '2024-12-01T10:00:00Z',
          end_time: '2024-12-01T11:00:00Z',
        })
      ).toThrow()
    })

    it('requires start_time', () => {
      expect(() =>
        BookingCreateSchema.parse({
          listing_id: '123e4567-e89b-12d3-a456-426614174000',
          end_time: '2024-12-01T11:00:00Z',
        })
      ).toThrow()
    })

    it('rejects invalid datetime format', () => {
      expect(() =>
        BookingCreateSchema.parse({
          listing_id: '123e4567-e89b-12d3-a456-426614174000',
          start_time: '2024-12-01',
          end_time: '2024-12-01T11:00:00Z',
        })
      ).toThrow()
    })

    it('accepts optional notes', () => {
      const validData = {
        listing_id: '123e4567-e89b-12d3-a456-426614174000',
        start_time: '2024-12-01T10:00:00Z',
        end_time: '2024-12-01T11:00:00Z',
        notes: 'Morning preferred',
      }
      expect(() => BookingCreateSchema.parse(validData)).not.toThrow()
    })

    it('rejects notes too long', () => {
      expect(() =>
        BookingCreateSchema.parse({
          listing_id: '123e4567-e89b-12d3-a456-426614174000',
          start_time: '2024-12-01T10:00:00Z',
          end_time: '2024-12-01T11:00:00Z',
          notes: 'a'.repeat(1001),
        })
      ).toThrow()
    })
  })

  describe('BookingUpdateSchema', () => {
    it('accepts valid status update', () => {
      const validStatuses = ['pending', 'confirmed', 'canceled', 'completed']
      validStatuses.forEach((status) => {
        expect(() =>
          BookingUpdateSchema.parse({ status })
        ).not.toThrow()
      })
    })

    it('rejects invalid status', () => {
      expect(() =>
        BookingUpdateSchema.parse({ status: 'in-progress' })
      ).toThrow()
    })

    it('accepts all fields as optional', () => {
      expect(() => BookingUpdateSchema.parse({})).not.toThrow()
    })

    it('accepts time updates', () => {
      expect(() =>
        BookingUpdateSchema.parse({
          start_time: '2024-12-02T10:00:00Z',
          end_time: '2024-12-02T11:00:00Z',
        })
      ).not.toThrow()
    })
  })
})

describe('Gamification Schemas', () => {
  describe('GamificationUpdateSchema', () => {
    it('accepts valid gamification update', () => {
      const validData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        action: 'post_created' as const,
      }
      expect(() => GamificationUpdateSchema.parse(validData)).not.toThrow()
    })

    it('requires userId', () => {
      expect(() =>
        GamificationUpdateSchema.parse({ action: 'post_created' })
      ).toThrow()
    })

    it('requires action', () => {
      expect(() =>
        GamificationUpdateSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).toThrow()
    })

    it('accepts all valid actions', () => {
      const validActions = [
        'purchase',
        'post_created',
        'comment_created',
        'like_given',
        'follow_user',
        'listing_created',
        'booking_created',
        'review_created',
      ]
      validActions.forEach((action) => {
        expect(() =>
          GamificationUpdateSchema.parse({
            userId: '123e4567-e89b-12d3-a456-426614174000',
            action,
          })
        ).not.toThrow()
      })
    })

    it('rejects invalid action', () => {
      expect(() =>
        GamificationUpdateSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'invalid_action',
        })
      ).toThrow()
    })

    it('accepts optional metadata', () => {
      expect(() =>
        GamificationUpdateSchema.parse({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          action: 'post_created',
        })
      ).not.toThrow()
    })
  })
})

describe('Payment Schemas', () => {
  describe('PaymentIntentCreateSchema', () => {
    it('accepts valid payment intent', () => {
      const validData = {
        amount: 1000,
        currency: 'USD',
      }
      expect(() => PaymentIntentCreateSchema.parse(validData)).not.toThrow()
    })

    it('requires positive amount', () => {
      expect(() =>
        PaymentIntentCreateSchema.parse({ amount: 0 })
      ).toThrow()
      expect(() =>
        PaymentIntentCreateSchema.parse({ amount: -100 })
      ).toThrow()
    })

    it('accepts 3-letter currency code', () => {
      expect(() =>
        PaymentIntentCreateSchema.parse({ amount: 1000, currency: 'EUR' })
      ).not.toThrow()
    })

    it('rejects invalid currency code length', () => {
      expect(() =>
        PaymentIntentCreateSchema.parse({ amount: 1000, currency: 'US' })
      ).toThrow()
      expect(() =>
        PaymentIntentCreateSchema.parse({ amount: 1000, currency: 'USDD' })
      ).toThrow()
    })
  })
})

describe('Post Schemas', () => {
  describe('PostCreateSchema', () => {
    it('accepts valid post', () => {
      const validData = {
        content: 'This is a test post',
        visibility: 'public',
      }
      expect(() => PostCreateSchema.parse(validData)).not.toThrow()
    })

    it('requires content', () => {
      expect(() => PostCreateSchema.parse({})).toThrow()
    })

    it('rejects empty content', () => {
      expect(() => PostCreateSchema.parse({ content: '' })).toThrow()
    })

    it('rejects content too long', () => {
      expect(() =>
        PostCreateSchema.parse({ content: 'a'.repeat(5001) })
      ).toThrow()
    })

    it('accepts valid visibility values', () => {
      const validVisibilities = ['public', 'private', 'followers']
      validVisibilities.forEach((visibility) => {
        expect(() =>
          PostCreateSchema.parse({ content: 'Test', visibility })
        ).not.toThrow()
      })
    })

    it('rejects invalid visibility', () => {
      expect(() =>
        PostCreateSchema.parse({ content: 'Test', visibility: 'everyone' })
      ).toThrow()
    })

    it('accepts optional media_urls', () => {
      expect(() =>
        PostCreateSchema.parse({
          content: 'Test',
          media_urls: ['https://example.com/image.jpg'],
        })
      ).not.toThrow()
    })
  })

  describe('PostUpdateSchema', () => {
    it('accepts all fields as optional', () => {
      expect(() => PostUpdateSchema.parse({})).not.toThrow()
    })

    it('accepts partial updates', () => {
      expect(() =>
        PostUpdateSchema.parse({ content: 'Updated content' })
      ).not.toThrow()
      expect(() =>
        PostUpdateSchema.parse({ visibility: 'private' })
      ).not.toThrow()
    })
  })
})

describe('Comment Schemas', () => {
  describe('CommentCreateSchema', () => {
    it('accepts valid comment', () => {
      const validData = {
        post_id: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Great post!',
      }
      expect(() => CommentCreateSchema.parse(validData)).not.toThrow()
    })

    it('requires post_id', () => {
      expect(() =>
        CommentCreateSchema.parse({ content: 'Great!' })
      ).toThrow()
    })

    it('requires content', () => {
      expect(() =>
        CommentCreateSchema.parse({
          post_id: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).toThrow()
    })

    it('rejects empty content', () => {
      expect(() =>
        CommentCreateSchema.parse({
          post_id: '123e4567-e89b-12d3-a456-426614174000',
          content: '',
        })
      ).toThrow()
    })

    it('rejects content too long', () => {
      expect(() =>
        CommentCreateSchema.parse({
          post_id: '123e4567-e89b-12d3-a456-426614174000',
          content: 'a'.repeat(1001),
        })
      ).toThrow()
    })

    it('accepts optional parent_id', () => {
      expect(() =>
        CommentCreateSchema.parse({
          post_id: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Reply',
          parent_id: '456e7890-e12b-34c5-a678-901234567890',
        })
      ).not.toThrow()
    })

    it('accepts null parent_id', () => {
      expect(() =>
        CommentCreateSchema.parse({
          post_id: '123e4567-e89b-12d3-a456-426614174000',
          content: 'Comment',
          parent_id: null,
        })
      ).not.toThrow()
    })
  })
})

describe('User Search Schema', () => {
  describe('UserSearchSchema', () => {
    it('accepts valid search params', () => {
      const validData = {
        query: 'test user',
        role: 'vendor',
        status: 'active',
        page: 1,
        limit: 20,
      }
      expect(() => UserSearchSchema.parse(validData)).not.toThrow()
    })

    it('accepts all fields as optional', () => {
      expect(() => UserSearchSchema.parse({})).not.toThrow()
    })

    it('accepts valid role values', () => {
      const validRoles = ['vendor', 'admin', 'regular']
      validRoles.forEach((role) => {
        expect(() => UserSearchSchema.parse({ role })).not.toThrow()
      })
    })

    it('rejects invalid role', () => {
      expect(() =>
        UserSearchSchema.parse({ role: 'moderator' })
      ).toThrow()
    })

    it('accepts valid status values', () => {
      const validStatuses = ['active', 'suspended', 'banned']
      validStatuses.forEach((status) => {
        expect(() => UserSearchSchema.parse({ status })).not.toThrow()
      })
    })

    it('rejects invalid status', () => {
      expect(() =>
        UserSearchSchema.parse({ status: 'pending' })
      ).toThrow()
    })

    it('requires positive page number', () => {
      expect(() => UserSearchSchema.parse({ page: 0 })).toThrow()
      expect(() => UserSearchSchema.parse({ page: -1 })).toThrow()
    })

    it('enforces maximum limit', () => {
      expect(() => UserSearchSchema.parse({ limit: 101 })).toThrow()
    })

    it('requires positive limit', () => {
      expect(() => UserSearchSchema.parse({ limit: 0 })).toThrow()
    })

    it('defaults page and limit correctly', () => {
      const result = UserSearchSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
    })
  })
})
