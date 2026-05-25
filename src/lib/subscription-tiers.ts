/**
 * Subscription Tier Configuration
 * Defines the 4 subscription tiers with their features, limits, and pricing
 */

export type SubscriptionTier = 'free' | 'basic' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';

export interface SubscriptionTierConfig {
  name: string;
  price: number;
  priceId: string;
  listingLimit: number; // -1 means unlimited
  transactionFee: number; // Percentage (e.g., 2.0 = 2%)
  features: string[];
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionTierConfig> = {
  free: {
    name: 'Starter Vendor',
    price: 0,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_FREE || 'price_starter',
    listingLimit: 5,
    transactionFee: 2.0, // 2%
    features: [
      'basic_analytics',
      'basic_shippo',
      'starter_badge',
    ],
  },
  basic: {
    name: 'Growing Vendor',
    price: 9.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC || 'price_basic',
    listingLimit: 30,
    transactionFee: 1.5, // 1.5%
    features: [
      'verified_badge',
      'boost_access',
      'priority_search',
      'advanced_shippo',
      'discount_codes',
    ],
  },
  pro: {
    name: 'Serious Vendor',
    price: 29.99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_pro',
    listingLimit: -1, // Unlimited
    transactionFee: 1.0, // 1%
    features: [
      'featured_slots',
      'analytics_dashboard',
      'brand_customization',
      'priority_support',
      'leaderboard',
      'api_access',
      'shipping_automation',
      'referral_bonuses',
    ],
  },
  premium: {
    name: 'Enterprise Vendor',
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM || 'price_premium',
    listingLimit: -1, // Unlimited
    transactionFee: 0.5, // 0.5%
    features: [
      'all_pro_features',
      'dedicated_support',
      'custom_storefront',
      'team_accounts',
      'ai_automations',
      'weekly_reports',
    ],
  },
} as const;

/**
 * Get subscription tier configuration
 */
export function getTierConfig(tier: SubscriptionTier): SubscriptionTierConfig {
  return SUBSCRIPTION_TIERS[tier];
}

/**
 * Get transaction fee for a tier
 */
export function getTransactionFee(tier: SubscriptionTier): number {
  return SUBSCRIPTION_TIERS[tier].transactionFee;
}

/**
 * Get listing limit for a tier
 */
export function getListingLimit(tier: SubscriptionTier): number {
  return SUBSCRIPTION_TIERS[tier].listingLimit;
}

/**
 * Check if tier has unlimited listings
 */
export function hasUnlimitedListings(tier: SubscriptionTier): boolean {
  return SUBSCRIPTION_TIERS[tier].listingLimit === -1;
}

/**
 * Check if tier has access to a feature
 */
export function hasFeatureAccess(tier: SubscriptionTier, feature: string): boolean {
  const config = SUBSCRIPTION_TIERS[tier];
  return config.features.includes(feature) || tier === 'premium'; // Premium has all features
}

/**
 * Get all available tiers
 */
export function getAvailableTiers(): SubscriptionTier[] {
  return ['free', 'basic', 'pro', 'premium'];
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIERS[tier].name;
}

