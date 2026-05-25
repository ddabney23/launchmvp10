/**
 * Mock API layer for test mode
 * Provides mock data when Supabase is not accessible (test mode)
 */

import type {
  Profile,
  Post,
  Listing,
  Order,
  Booking,
  Message,
  Notification,
  Badge,
  Leaderboard,
  Group,
} from "./types";

const isTestMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() === "" || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() === "");

// Mock data generators
function createMockProfile(userId: string, email: string): Profile {
  return {
    id: userId,
    username: email.split("@")[0] || "testuser",
    display_name: email.split("@")[0] || "Test User",
    email: email,
    avatar_url: null,
    bio: null,
    created_at: new Date().toISOString(),
    is_vendor: false,
    vendor_verified: false,
    points: 0,
    credits: 0,
  };
}

// Mock API functions that return empty arrays/objects instead of failing
export const mockApi = {
  getProfile: async (userId: string): Promise<Profile> => {
    const testUserStr = sessionStorage.getItem("test_mode_user");
    if (testUserStr) {
      const testUser = JSON.parse(testUserStr);
      return createMockProfile(userId, testUser.email);
    }
    return createMockProfile(userId, "test@example.com");
  },

  getPersonalizedFeed: async (userId: string, page: number, pageSize: number): Promise<Post[]> => {
    return [];
  },

  getRecommendedListings: async (userId: string, limit: number): Promise<Listing[]> => {
    return [];
  },

  getRecommendedVendors: async (userId: string, limit: number): Promise<Profile[]> => {
    return [];
  },

  getFollowing: async (userId: string): Promise<Profile[]> => {
    return [];
  },

  getLeaderboard: async (period: string, limit: number): Promise<Leaderboard[]> => {
    return [];
  },

  getUserBadges: async (userId: string): Promise<Badge[]> => {
    return [];
  },

  getAllPosts: async (page: number, pageSize: number): Promise<Post[]> => {
    return [];
  },

  getAllListings: async (page: number, pageSize: number): Promise<Listing[]> => {
    return [];
  },

  getAllVendors: async (): Promise<Profile[]> => {
    return [];
  },

  getOrders: async (userId: string): Promise<Order[]> => {
    return [];
  },

  getBookings: async (userId: string): Promise<Booking[]> => {
    return [];
  },

  getMessages: async (userId: string): Promise<Message[]> => {
    return [];
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    return [];
  },

  getGroups: async (): Promise<Group[]> => {
    return [];
  },
};

// Check if we should use mock API
export function shouldUseMockApi(): boolean {
  return isTestMode;
}

