import { describe, it, expect } from 'vitest'
import {
  ProfileSchema,
  PostCreateSchema,
  ListingCreateSchema,
  BookingCreateSchema,
} from '../validators'

describe('Validators', () => {
  describe('ProfileSchema', () => {
    it('should validate a valid profile', () => {
      const validProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        display_name: 'Test User',
        bio: 'Test bio',
        avatar_url: 'https://example.com/avatar.jpg',
        is_vendor: false,
        vendor_verified: false,
        credits: 0,
        points: 0,
      }

      const result = ProfileSchema.safeParse(validProfile)
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const invalidProfile = {
        id: 'invalid-uuid',
        username: 'testuser',
      }

      const result = ProfileSchema.safeParse(invalidProfile)
      expect(result.success).toBe(false)
    })
  })

  describe('PostCreateSchema', () => {
    it('should validate a valid post', () => {
      const validPost = {
        author: '123e4567-e89b-12d3-a456-426614174000',
        content: 'This is a test post',
        media_urls: ['https://example.com/image.jpg'],
        visibility: 'public' as const,
      }

      const result = PostCreateSchema.safeParse(validPost)
      expect(result.success).toBe(true)
    })

    it('should reject empty content', () => {
      const invalidPost = {
        author: '123e4567-e89b-12d3-a456-426614174000',
        content: '',
        visibility: 'public' as const,
      }

      const result = PostCreateSchema.safeParse(invalidPost)
      expect(result.success).toBe(false)
    })
  })

  describe('ListingCreateSchema', () => {
    it('should validate a valid listing', () => {
      const validListing = {
        vendor: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Listing',
        description: 'Test description',
        price: 99.99,
        category: 'electronics',
        quantity: 10,
        images: ['https://example.com/image.jpg'],
      }

      const result = ListingCreateSchema.safeParse(validListing)
      expect(result.success).toBe(true)
    })

    it('should reject negative price', () => {
      const invalidListing = {
        vendor: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Listing',
        description: 'Test description',
        price: -10,
      }

      const result = ListingCreateSchema.safeParse(invalidListing)
      expect(result.success).toBe(false)
    })
  })

  describe('BookingCreateSchema', () => {
    it('should validate a valid booking', () => {
      const validBooking = {
        listing_id: '123e4567-e89b-12d3-a456-426614174000',
        start_time: new Date('2024-12-01T10:00:00Z').toISOString(),
        end_time: new Date('2024-12-01T11:00:00Z').toISOString(),
      }

      const result = BookingCreateSchema.safeParse(validBooking)
      expect(result.success).toBe(true)
    })

    it('should reject end_time before start_time', () => {
      const invalidBooking = {
        listing_id: '123e4567-e89b-12d3-a456-426614174000',
        start_time: new Date('2024-12-01T11:00:00Z').toISOString(),
        end_time: new Date('2024-12-01T10:00:00Z').toISOString(),
      }

      const result = BookingCreateSchema.safeParse(invalidBooking)
      expect(result.success).toBe(false)
    })
  })
})

