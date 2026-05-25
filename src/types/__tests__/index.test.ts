/**
 * Type Guard Tests
 * 
 * Comprehensive tests for all type guards to ensure runtime type safety
 */

import { describe, it, expect } from 'vitest'
import {
  isProfile,
  isVendorProfile,
  isAdmin,
  isVendor,
  isVerifiedVendor,
  isValidPost,
  isValidListing,
  isValidOrder,
  isProfileWithVendor,
} from '../index'
import type {
  Profile,
  VendorProfile,
  Post,
  Listing,
  Order,
  ProfileWithVendor,
} from '../index'

// ============================================================================
// PROFILE TYPE GUARDS
// ============================================================================

describe('isProfile', () => {
  it('should return true for valid profile', () => {
    const profile: Profile = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      display_name: 'Test User',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg',
      email: 'test@example.com',
      phone: null,
      city: null,
      state: null,
      school: null,
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
      points: 0,
      credits: 0,
      reputation_score: 0,
      account_status: 'active',
      admin_notes: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    expect(isProfile(profile)).toBe(true)
  })

  it('should return false for null', () => {
    expect(isProfile(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isProfile(undefined)).toBe(false)
  })

  it('should return false for missing required fields', () => {
    const invalid = {
      id: '123',
      // missing username
      is_vendor: false,
    }

    expect(isProfile(invalid)).toBe(false)
  })

  it('should return false for wrong types', () => {
    const invalid = {
      id: '123',
      username: 123, // should be string
      is_vendor: 'false', // should be boolean
    }

    expect(isProfile(invalid)).toBe(false)
  })
})

describe('isAdmin', () => {
  it('should return true for admin profile', () => {
    const profile = {
      id: '123',
      username: 'admin',
      is_admin: true,
      is_vendor: false,
      vendor_verified: false,
    }

    expect(isAdmin(profile)).toBe(true)
  })

  it('should return false for non-admin profile', () => {
    const profile = {
      id: '123',
      username: 'user',
      is_admin: false,
      is_vendor: false,
      vendor_verified: false,
    }

    expect(isAdmin(profile)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isAdmin(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('isVendor', () => {
  it('should return true for vendor profile', () => {
    const profile = {
      id: '123',
      username: 'vendor',
      is_vendor: true,
      is_admin: false,
      vendor_verified: false,
    }

    expect(isVendor(profile)).toBe(true)
  })

  it('should return false for non-vendor profile', () => {
    const profile = {
      id: '123',
      username: 'user',
      is_vendor: false,
      is_admin: false,
      vendor_verified: false,
    }

    expect(isVendor(profile)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isVendor(null)).toBe(false)
  })
})

describe('isVerifiedVendor', () => {
  it('should return true for verified vendor', () => {
    const profile = {
      id: '123',
      username: 'vendor',
      is_vendor: true,
      vendor_verified: true,
      is_admin: false,
    }

    expect(isVerifiedVendor(profile)).toBe(true)
  })

  it('should return false for unverified vendor', () => {
    const profile = {
      id: '123',
      username: 'vendor',
      is_vendor: true,
      vendor_verified: false,
      is_admin: false,
    }

    expect(isVerifiedVendor(profile)).toBe(false)
  })

  it('should return false for non-vendor', () => {
    const profile = {
      id: '123',
      username: 'user',
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
    }

    expect(isVerifiedVendor(profile)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isVerifiedVendor(null)).toBe(false)
  })
})

// ============================================================================
// ENTITY TYPE GUARDS
// ============================================================================

describe('isValidPost', () => {
  it('should return true for valid post', () => {
    const post: Post = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      author: '123e4567-e89b-12d3-a456-426614174001',
      content: 'Test post content',
      media_urls: ['https://example.com/image.jpg'],
      visibility: 'public',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    expect(isValidPost(post)).toBe(true)
  })

  it('should return false for missing required fields', () => {
    const invalid = {
      id: '123',
      // missing author and content
      visibility: 'public',
    }

    expect(isValidPost(invalid)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isValidPost(null)).toBe(false)
  })

  it('should return false for empty content', () => {
    const invalid = {
      id: '123',
      author: '456',
      content: '', // empty string
      visibility: 'public',
    }

    expect(isValidPost(invalid)).toBe(false)
  })
})

describe('isValidListing', () => {
  it('should return true for valid listing', () => {
    const listing: Listing = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      vendor: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Test Product',
      description: 'Test description',
      price: 99.99,
      currency: 'USD',
      images: ['https://example.com/image.jpg'],
      quantity: 10,
      category: 'Electronics',
      active: true,
      location: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    expect(isValidListing(listing)).toBe(true)
  })

  it('should return false for negative price', () => {
    const invalid = {
      id: '123',
      vendor: '456',
      title: 'Test',
      price: -10, // negative price
      currency: 'USD',
      quantity: 10,
      active: true,
    }

    expect(isValidListing(invalid)).toBe(false)
  })

  it('should return false for missing required fields', () => {
    const invalid = {
      id: '123',
      // missing vendor, title, price
      active: true,
    }

    expect(isValidListing(invalid)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isValidListing(null)).toBe(false)
  })
})

describe('isValidOrder', () => {
  it('should return true for valid order', () => {
    const order: Order = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      buyer: '123e4567-e89b-12d3-a456-426614174001',
      vendor: '123e4567-e89b-12d3-a456-426614174002',
      total_amount: 99.99,
      currency: 'USD',
      status: 'pending',
      payment_status: 'pending',
      items: [],
      shipping_address: null,
      metadata: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    expect(isValidOrder(order)).toBe(true)
  })

  it('should return false for negative total amount', () => {
    const invalid = {
      id: '123',
      buyer: '456',
      vendor: '789',
      total_amount: -50, // negative amount
      status: 'pending',
      payment_status: 'pending',
    }

    expect(isValidOrder(invalid)).toBe(false)
  })

  it('should return false for invalid status', () => {
    const invalid = {
      id: '123',
      buyer: '456',
      vendor: '789',
      total_amount: 99.99,
      status: 'invalid_status', // not a valid status
      payment_status: 'pending',
    }

    expect(isValidOrder(invalid)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isValidOrder(null)).toBe(false)
  })
})

// ============================================================================
// COMPOSITE TYPE GUARDS
// ============================================================================

describe('isProfileWithVendor', () => {
  it('should return true for profile with vendor_profile', () => {
    const profile: ProfileWithVendor = {
      id: '123',
      username: 'vendor',
      display_name: 'Vendor User',
      bio: null,
      avatar_url: null,
      email: 'vendor@example.com',
      phone: null,
      city: null,
      state: null,
      school: null,
      is_vendor: true,
      vendor_verified: true,
      is_admin: false,
      points: 0,
      credits: 0,
      reputation_score: 0,
      account_status: 'active',
      admin_notes: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      vendor_profile: {
        id: '456',
        user_id: '123',
        business_name: 'Test Business',
        business_email: 'business@example.com',
        business_phone: null,
        business_address: null,
        stripe_account_id: null,
        stripe_onboard_status: 'pending',
        payout_balance: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    }

    expect(isProfileWithVendor(profile)).toBe(true)
  })

  it('should return true for profile with null vendor_profile', () => {
    const profile = {
      id: '123',
      username: 'user',
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
      vendor_profile: null,
    }

    expect(isProfileWithVendor(profile)).toBe(true)
  })

  it('should return false for invalid profile', () => {
    const invalid = {
      id: '123',
      // missing required fields
      vendor_profile: null,
    }

    expect(isProfileWithVendor(invalid)).toBe(false)
  })

  it('should return false for null', () => {
    expect(isProfileWithVendor(null)).toBe(false)
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle objects with extra properties', () => {
    const profile = {
      id: '123',
      username: 'user',
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
      extra_field: 'should be ignored',
    }

    // Should still validate even with extra fields
    expect(isVendor(profile)).toBe(false)
  })

  it('should handle empty strings correctly', () => {
    const profile = {
      id: '',
      username: '',
      is_vendor: false,
      vendor_verified: false,
      is_admin: false,
    }

    // Empty strings should still be considered valid strings
    expect(isAdmin(profile)).toBe(false)
  })

  it('should handle numeric strings', () => {
    const invalid = {
      id: '123',
      username: '456',
      is_vendor: '0', // string instead of boolean
      vendor_verified: false,
      is_admin: false,
    }

    expect(isVendor(invalid)).toBe(false)
  })
})
