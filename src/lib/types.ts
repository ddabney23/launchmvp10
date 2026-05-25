// Re-export types from validators for convenience
export type {
  Profile,
  ProfileUpdate,
  Post,
  PostCreate,
  PostUpdate,
  Follow,
  FollowCreate,
  Comment,
  CommentCreate,
  Like,
  LikeCreate,
  Listing,
  ListingCreate,
  ListingUpdate,
  Location,
  Order,
  OrderCreate,
  OrderUpdate,
  OrderItem,
  OrderItemCreate,
  Booking,
  BookingCreate,
  BookingUpdate,
  Message,
  MessageCreate,
  Notification,
  Badge,
  SignUp,
  SignIn,
  Onboarding,
  VendorApplication,
  VendorProfile,
  VendorProfileCreate,
  VendorProfileUpdate,
  Group,
  GroupCreate,
  GroupUpdate,
  GroupMember,
  GroupMemberCreate,
  StoreProfile,
  StoreProfileCreate,
  StoreProfileUpdate,
  Transaction,
  Payout,
  Review,
  ReviewCreate,
  ReviewUpdate,
  UserPoints,
  CartItem,
  News,
  NewsCreate,
  NewsUpdate,
  Leaderboard,
  Story,
  StoryCreate,
  StoryUpdate,
  StoryView,
  StoryViewCreate,
  StoryReply,
  StoryReplyCreate,
} from "./validators";

// Coupon types (exported from api.ts)
export type { Coupon, CouponCreate, CouponUpdate } from "./api";

// Badge management types (exported from api.ts)
export type { BadgeCreate, BadgeUpdate } from "./api";

// Extended types for UI components
export interface PostWithAuthor extends Post {
  author_profile?: Profile;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export interface CommentWithAuthor extends Comment {
  author_profile?: Profile;
  likes_count?: number;
  is_liked?: boolean;
}

export interface ListingWithVendor extends Listing {
  vendor_profile?: Profile;
  likes_count?: number;
  is_liked?: boolean;
}

export interface OrderWithDetails extends Order {
  items?: Array<OrderItem & { listing?: Listing }>;
  buyer_profile?: Profile;
  vendor_profile?: Profile;
}

export interface BookingWithDetails extends Booking {
  listing?: Listing;
  buyer_profile?: Profile;
  vendor_profile?: Profile;
}

export interface NotificationWithData extends Notification {
  notification_data?: {
    post_id?: string;
    comment_id?: string;
    listing_id?: string;
    order_id?: string;
    booking_id?: string;
    user_id?: string;
    [key: string]: any;
  };
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

// Realtime subscription types
export type RealtimeEvent<T = any> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
};

// Subscription types
export type { SubscriptionTier, SubscriptionStatus } from "./subscription-tiers";

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ShippingLabel {
  id: string;
  order_id: string;
  vendor_id: string;
  shippo_transaction_id: string | null;
  tracking_number: string | null;
  carrier: string | null;
  service_level: string | null;
  label_url: string | null;
  tracking_url: string | null;
  status: 'pending' | 'purchased' | 'printed' | 'shipped' | 'delivered' | 'error';
  cost: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

