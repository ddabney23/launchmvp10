/**
 * Gamification Helper Functions
 * 
 * Utility functions for managing points, credits, and badges
 */

import { supabase } from "@/integrations/supabase/client";
import { ensureProfileUuid } from "./user-id-helpers";
import type { Profile, Badge } from "./types";

/**
 * Award points to a user
 * This uses the database function which handles badge eligibility
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  const { error } = await supabase.rpc("award_points", {
    user_id_param: profileUuid, // Use profile UUID
    points_amount: points,
    event_type: reason,
    metadata_param: metadata || {},
  });

  if (error) {
    throw new Error(`Failed to award points: ${error.message}`);
  }
}

/**
 * Add credits to a user's account
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function addCredits(
  userId: string,
  credits: number,
  reason?: string
): Promise<void> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  // Get current credits
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", profileUuid) // Use profile UUID
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch profile: ${fetchError.message}`);
  }

  const newCredits = (profile?.credits || 0) + credits;

  const { error } = await supabase
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", profileUuid); // Use profile UUID

  if (error) {
    throw new Error(`Failed to add credits: ${error.message}`);
  }
}

/**
 * Redeem credits from a user's account
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function redeemCredits(
  userId: string,
  credits: number,
  reason?: string
): Promise<void> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  // Get current credits
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", profileUuid) // Use profile UUID
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch profile: ${fetchError.message}`);
  }

  const currentCredits = profile?.credits || 0;

  if (currentCredits < credits) {
    throw new Error("Insufficient credits");
  }

  const newCredits = currentCredits - credits;

  const { error } = await supabase
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", profileUuid); // Use profile UUID

  if (error) {
    throw new Error(`Failed to redeem credits: ${error.message}`);
  }
}

/**
 * Check if user has a specific badge
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function hasBadge(userId: string, badgeKey: string): Promise<boolean> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  const { data, error } = await supabase
    .from("user_badges")
    .select(`
      badge:badges!inner(key)
    `)
    .eq("user_id", profileUuid) // Use profile UUID
    .eq("badges.key", badgeKey)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check badge: ${error.message}`);
  }

  return (data?.length || 0) > 0;
}

/**
 * Award a badge to a user
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function awardBadge(userId: string, badgeKey: string): Promise<void> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  // First, get the badge ID
  const { data: badge, error: badgeError } = await supabase
    .from("badges")
    .select("id")
    .eq("key", badgeKey)
    .single();

  if (badgeError || !badge) {
    throw new Error(`Badge not found: ${badgeKey}`);
  }

  // Award the badge (ignore conflict if already awarded)
  const { error } = await supabase
    .from("user_badges")
    .insert({
      user_id: profileUuid, // Use profile UUID
      badge_id: badge.id,
    })
    .select();

  if (error && !error.message.includes("duplicate")) {
    throw new Error(`Failed to award badge: ${error.message}`);
  }
}

/**
 * Get user's total points
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function getUserPoints(userId: string): Promise<number> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", profileUuid) // Use profile UUID
    .single();

  if (error) {
    throw new Error(`Failed to get points: ${error.message}`);
  }

  return data?.points || 0;
}

/**
 * Get user's total credits
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function getUserCredits(userId: string): Promise<number> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  const { data, error } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", profileUuid) // Use profile UUID
    .single();

  if (error) {
    throw new Error(`Failed to get credits: ${error.message}`);
  }

  return data?.credits || 0;
}

/**
 * Get user's rank based on points
 * userId can be Clerk ID or UUID - will be converted to UUID
 */
export async function getUserRank(userId: string, period: "daily" | "weekly" | "monthly" | "all_time" = "all_time"): Promise<number | null> {
  // Ensure userId is a profile UUID (not Clerk ID)
  const profileUuid = await ensureProfileUuid(userId);

  const { data, error } = await supabase
    .from("leaderboard")
    .select("rank")
    .eq("user_id", profileUuid) // Use profile UUID
    .eq("period", period)
    .single();

  if (error) {
    return null;
  }

  return data?.rank || null;
}

/**
 * Points earned for different actions
 */
export const POINTS_REWARDS = {
  CREATE_POST: 5,
  LIKE_POST: 1,
  COMMENT: 2,
  CREATE_LISTING: 10,
  FIRST_SALE: 50,
  ORDER_COMPLETED: 10,
  SALE_COMPLETED: 25,
  GROUP_CREATED: 15,
  REVIEW_CREATED: 5,
  FIRST_GROUP_JOIN: 5,
  ONBOARDING_COMPLETED: 10,
} as const;

/**
 * Credits earned for different actions
 */
export const CREDITS_REWARDS = {
  WELCOME_BONUS: 50,
  FIRST_PURCHASE: 10,
  REFERRAL: 25,
} as const;

/**
 * Badge thresholds based on points
 */
export const BADGE_THRESHOLDS = {
  MEMBER: 50,
  CONTRIBUTOR: 100,
  ACTIVE: 250,
  DEDICATED: 500,
  POWER_USER: 1000,
} as const;

/**
 * Helper to get next badge threshold
 */
export function getNextBadgeThreshold(currentPoints: number): { threshold: number; name: string } | null {
  const thresholds = Object.entries(BADGE_THRESHOLDS)
    .map(([name, threshold]) => ({ name, threshold }))
    .sort((a, b) => a.threshold - b.threshold);

  const next = thresholds.find((t) => currentPoints < t.threshold);
  return next || null;
}

/**
 * Helper to format points with icon
 */
export function formatPoints(points: number): string {
  return `${points.toLocaleString()} pts`;
}

/**
 * Helper to format credits with icon
 */
export function formatCredits(credits: number): string {
  return `${credits.toLocaleString()} credits`;
}

