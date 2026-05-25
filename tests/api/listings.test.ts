/**
 * Unit tests for Listing Validators
 * Tests validation schemas for listings creation and updates
 */

import { describe, it, expect } from '@jest/globals'
import { ListingCreateSchema, ListingUpdateSchema } from '@/lib/validators'

describe('Listing Validators', () => {
  describe('ListingCreateSchema', () => {
    it('should validate a valid listing with all required fields', () => {
      const validListing = {
        title: 'Test Product',
        description: 'This is a test product description',
        price: 99.99,
        category: 'Electronics',
      }

      const result = ListingCreateSchema.safeParse(validListing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Test Product')
        expect(result.data.price).toBe(99.99)
        expect(result.data.currency).toBe('USD') // Default value
        expect(result.data.images).toEqual([]) // Default value
        expect(result.data.active).toBe(true) // Default value
      }
    })

    it('should validate listing with optional vendor UUID', () => {
      const listing = {
        vendor: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.vendor).toBe('123e4567-e89b-12d3-a456-426614174000')
      }
    })

    it('should reject invalid vendor UUID', () => {
      const listing = {
        vendor: 'invalid-uuid-format',
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('vendor'))).toBe(true)
      }
    })

    it('should reject missing title', () => {
      const listing = {
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('title'))).toBe(true)
      }
    })

    it('should reject empty title', () => {
      const listing = {
        title: '',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should reject title longer than 200 characters', () => {
      const listing = {
        title: 'a'.repeat(201),
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should accept title exactly 200 characters', () => {
      const listing = {
        title: 'a'.repeat(200),
        description: 'Test description',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
    })

    it('should reject missing description', () => {
      const listing = {
        title: 'Test Product',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should reject empty description', () => {
      const listing = {
        title: 'Test Product',
        description: '',
        price: 49.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should reject negative price', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: -10.00,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('price'))).toBe(true)
      }
    })

    it('should reject price exceeding maximum (9999999.99)', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 10000000.00,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should accept price at maximum (9999999.99)', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 9999999.99,
        category: 'Books',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
    })

    it('should accept zero price', () => {
      const listing = {
        title: 'Free Item',
        description: 'This is free',
        price: 0,
        category: 'Free',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
    })

    it('should reject missing category', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should reject empty category', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: '',
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should validate listing with valid image URLs', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.png',
        ],
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.images).toHaveLength(2)
      }
    })

    it('should reject invalid image URLs', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        images: ['not-a-valid-url', 'also-invalid'],
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should validate listing with quantity', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        quantity: 100,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.quantity).toBe(100)
      }
    })

    it('should reject negative quantity', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        quantity: -5,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should reject non-integer quantity', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        quantity: 10.5,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(false)
    })

    it('should validate listing with location', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.location?.lat).toBe(40.7128)
        expect(result.data.location?.lng).toBe(-74.0060)
      }
    })

    it('should validate listing with active flag', () => {
      const listing = {
        title: 'Test Product',
        description: 'Test description',
        price: 49.99,
        category: 'Books',
        active: false,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.active).toBe(false)
      }
    })

    it('should validate complete listing with all optional fields', () => {
      const listing = {
        vendor: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Complete Product',
        description: 'Full description with all fields',
        price: 299.99,
        currency: 'EUR',
        category: 'Electronics',
        images: ['https://example.com/image.jpg'],
        quantity: 50,
        location: {
          lat: 51.5074,
          lng: -0.1278,
        },
        active: true,
      }

      const result = ListingCreateSchema.safeParse(listing)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.vendor).toBe('123e4567-e89b-12d3-a456-426614174000')
        expect(result.data.currency).toBe('EUR')
        expect(result.data.quantity).toBe(50)
        expect(result.data.active).toBe(true)
      }
    })
  })

  describe('ListingUpdateSchema', () => {
    it('should allow partial updates', () => {
      const update = {
        title: 'Updated Title',
      }

      const result = ListingUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated Title')
      }
    })

    it('should allow updating only price', () => {
      const update = {
        price: 149.99,
      }

      const result = ListingUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should allow updating active status', () => {
      const update = {
        active: false,
      }

      const result = ListingUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.active).toBe(false)
      }
    })

    it('should reject invalid partial updates', () => {
      const update = {
        price: -50.00,
      }

      const result = ListingUpdateSchema.safeParse(update)
      expect(result.success).toBe(false)
    })

    it('should allow empty update object', () => {
      const update = {}

      const result = ListingUpdateSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })
})
