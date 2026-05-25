/**
 * Subscription Utility Functions
 * Helper functions for checking subscription limits, fees, and features
 */

import { createAdminClient } from '@/integrations/supabase/server'
import { SubscriptionTier, getTierConfig, getTransactionFee, getListingLimit, hasUnlimitedListings, hasFeatureAccess } from './subscription-tiers'
import { logger } from './logger'

export interface VendorSubscriptionInfo {
  tier: SubscriptionTier
  status: string
  listingLimit: number
  currentListings: number
  transactionFee: number
  canCreateListing: boolean
  hasUnlimitedListings: boolean
}

/**
 * Get vendor's subscription information
 */
export async function getVendorSubscription(vendorId: string): Promise<VendorSubscriptionInfo | null> {
  try {
    const adminClient = createAdminClient()

    // Get vendor profile with subscription info
    const { data: vendorProfile, error: profileError } = await adminClient
      .from('vendor_profiles')
      .select('subscription_tier, subscription_status, listing_limit, transaction_fee_percent')
      .eq('id', vendorId)
      .maybeSingle()

    if (profileError || !vendorProfile) {
      // If vendor_profile doesn't exist, that's okay - we'll use default tier config
      // Don't log as error, just return null to use defaults
      // PGRST116 = relation does not exist (table might not exist yet)
      // PGRST202 = no rows returned (vendor_profile doesn't exist for this vendor)
      if (profileError && profileError.code !== 'PGRST116' && profileError.code !== 'PGRST202') {
        logger.warn('Vendor profile error for subscription check', profileError, { vendorId })
      }
      return null
    }

    const tier = (vendorProfile.subscription_tier as SubscriptionTier) || 'free'
    const config = getTierConfig(tier)

    // Get current listing count (count ALL listings, active and inactive)
    // This ensures vendors can't exceed their limit by creating inactive listings
    const { count: listingCount, error: countError } = await adminClient
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('vendor', vendorId)

    if (countError) {
      logger.error('Failed to get listing count', countError, { vendorId })
    }

    const currentListings = listingCount || 0
    const listingLimit = vendorProfile.listing_limit || config.listingLimit
    const hasUnlimited = listingLimit === -1
    
    // Can create if unlimited OR if current count is less than limit
    // Note: We check < limit (not <=) because if limit is 5 and they have 5, they can't create another
    const canCreateListing = hasUnlimited || currentListings < listingLimit
    
    logger.info('Listing limit check', {
      vendorId,
      currentListings,
      listingLimit,
      hasUnlimited,
      canCreateListing,
      tier,
    })

    return {
      tier,
      status: vendorProfile.subscription_status || 'active',
      listingLimit,
      currentListings,
      transactionFee: Number(vendorProfile.transaction_fee_percent) || config.transactionFee,
      canCreateListing,
      hasUnlimitedListings: hasUnlimited,
    }
  } catch (error) {
    logger.error('Error getting vendor subscription', error, { vendorId })
    return null
  }
}

/**
 * Check if vendor can create a new listing
 * Returns true if vendor_profile doesn't exist (defaults to free tier with 5 listings)
 * Only returns false if limit is explicitly reached
 */
export async function canCreateListing(vendorId: string): Promise<boolean> {
  const subscription = await getVendorSubscription(vendorId)
  
  // If no subscription info found, allow creation (will default to free tier limits)
  // This handles new vendors who haven't set up their vendor_profile yet
  if (!subscription) {
    logger.warn('Vendor subscription not found, allowing listing creation with default limits', { vendorId })
    return true
  }
  
  return subscription.canCreateListing
}

/**
 * Get transaction fee for vendor
 */
export async function getVendorTransactionFee(vendorId: string): Promise<number> {
  const subscription = await getVendorSubscription(vendorId)
  if (!subscription) return 2.0 // Default to 2% if not found
  return subscription.transactionFee
}

/**
 * Check if vendor has access to a feature
 */
export async function vendorHasFeatureAccess(vendorId: string, feature: string): Promise<boolean> {
  const subscription = await getVendorSubscription(vendorId)
  if (!subscription) return false
  return hasFeatureAccess(subscription.tier, feature)
}

/**
 * Get listing limit for vendor
 */
export async function getVendorListingLimit(vendorId: string): Promise<number> {
  const subscription = await getVendorSubscription(vendorId)
  if (!subscription) return 5 // Default to 5 if not found
  return subscription.listingLimit
}

/**
 * Calculate application fee for a transaction based on vendor's tier
 */
export async function calculateApplicationFee(vendorId: string, amount: number): Promise<number> {
  const feePercent = await getVendorTransactionFee(vendorId)
  const fee = (amount * feePercent) / 100
  // Round to 2 decimal places
  return Math.round(fee * 100) / 100
}

