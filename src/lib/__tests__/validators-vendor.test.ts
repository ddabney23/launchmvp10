import { describe, it, expect } from 'vitest';
import {
  VendorProfileSchema,
  VendorProfileCreateSchema,
  GroupSchema,
  GroupCreateSchema,
  StoreProfileSchema,
  StoreProfileCreateSchema,
  ReviewSchema,
  ReviewCreateSchema,
  VendorApplicationSchema,
} from '../validators';

describe('Vendor Validators', () => {
  describe('VendorProfileSchema', () => {
    it('should validate a valid vendor profile', () => {
      const validProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        business_name: 'Test Business',
        business_email: 'test@business.com',
        business_phone: '+1234567890',
        business_address: { street: '123 Main St', city: 'Test City' },
        documents: [],
        payout_balance: 0,
        stripe_onboard_status: 'not_started' as const,
      };

      const result = VendorProfileSchema.safeParse(validProfile);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        business_name: 'Test Business',
        business_email: 'invalid-email',
      };

      const result = VendorProfileSchema.safeParse(invalidProfile);
      expect(result.success).toBe(false);
    });
  });

  describe('VendorApplicationSchema', () => {
    it('should validate a valid vendor application', () => {
      const validApplication = {
        business_name: 'Test Business',
        business_email: 'test@business.com',
        business_phone: '+1234567890',
        business_address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zip: '12345',
          country: 'US',
        },
        documents: [],
      };

      const result = VendorApplicationSchema.safeParse(validApplication);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidApplication = {
        business_name: '',
        business_email: 'invalid',
      };

      const result = VendorApplicationSchema.safeParse(invalidApplication);
      expect(result.success).toBe(false);
    });
  });

  describe('GroupSchema', () => {
    it('should validate a valid group', () => {
      const validGroup = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-group',
        name: 'Test Group',
        description: 'A test group',
        owner: '123e4567-e89b-12d3-a456-426614174000',
        is_public: true,
        member_count: 0,
      };

      const result = GroupSchema.safeParse(validGroup);
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug format', () => {
      const invalidGroup = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'Invalid Slug!',
        name: 'Test Group',
      };

      const result = GroupSchema.safeParse(invalidGroup);
      expect(result.success).toBe(false);
    });
  });

  describe('StoreProfileSchema', () => {
    it('should validate a valid store profile', () => {
      const validStore = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        vendor_profile_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Store',
        slug: 'test-store',
        images: ['https://example.com/image.jpg'],
        categories: ['electronics'],
        rating: 4.5,
        reviews_count: 10,
      };

      const result = StoreProfileSchema.safeParse(validStore);
      expect(result.success).toBe(true);
    });

    it('should reject rating > 5', () => {
      const invalidStore = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        vendor_profile_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Store',
        slug: 'test-store',
        rating: 6,
      };

      const result = StoreProfileSchema.safeParse(invalidStore);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewSchema', () => {
    it('should validate a valid review', () => {
      const validReview = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        buyer: '123e4567-e89b-12d3-a456-426614174000',
        rating: 5,
        title: 'Great product!',
        body: 'Really enjoyed this purchase.',
      };

      const result = ReviewSchema.safeParse(validReview);
      expect(result.success).toBe(true);
    });

    it('should reject rating < 1', () => {
      const invalidReview = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        rating: 0,
      };

      const result = ReviewSchema.safeParse(invalidReview);
      expect(result.success).toBe(false);
    });
  });
});

