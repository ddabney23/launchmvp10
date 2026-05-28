import { z } from "zod";

// Profile validators
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable()).optional(),
  is_vendor: z.boolean().default(false),
  vendor_verified: z.boolean().default(false),
  is_admin: z.boolean().default(false).optional(),
  credits: z.number().int().min(0).default(0),
  points: z.number().int().min(0).default(0),
  onboarding_completed: z.boolean().optional(),
  email: z.string().email().optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const ProfileUpdateSchema = ProfileSchema.partial().omit({ id: true, created_at: true });

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

// Post validators
export const PostSchema = z.object({
  id: z.string().uuid(),
  author: z.string().uuid(),
  content: z.string().min(1).max(5000),
  media_urls: z.array(z.string().url()).default([]),
  visibility: z.enum(["public", "private", "followers"]).default("public"),
  mentions: z.array(z.string().uuid()).max(20).optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const PostCreateSchema = PostSchema.omit({ id: true, created_at: true, updated_at: true });
export const PostUpdateSchema = PostCreateSchema.partial();

export type Post = z.infer<typeof PostSchema>;
export type PostCreate = z.infer<typeof PostCreateSchema>;
export type PostUpdate = z.infer<typeof PostUpdateSchema>;

// Story validators
export const StorySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  media_url: z.string().url(),
  media_type: z.enum(["image", "video"]),
  caption: z.string().max(500).optional().nullable(),
  visibility: z.enum(["public", "followers"]).default("public"),
  view_count: z.number().int().min(0).default(0),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const StoryCreateSchema = StorySchema.omit({ id: true, created_at: true, updated_at: true, view_count: true });
export const StoryUpdateSchema = StoryCreateSchema.partial();

export type Story = z.infer<typeof StorySchema>;
export type StoryCreate = z.infer<typeof StoryCreateSchema>;
export type StoryUpdate = z.infer<typeof StoryUpdateSchema>;

// Story View validators
export const StoryViewSchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  viewer_id: z.string().uuid(),
  created_at: z.string().datetime().optional(),
});

export const StoryViewCreateSchema = StoryViewSchema.omit({ id: true, created_at: true });

export type StoryView = z.infer<typeof StoryViewSchema>;
export type StoryViewCreate = z.infer<typeof StoryViewCreateSchema>;

// Story Reply validators
export const StoryReplySchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message: z.string().min(1).max(500),
  created_at: z.string().datetime().optional(),
});

export const StoryReplyCreateSchema = StoryReplySchema.omit({ id: true, created_at: true });

export type StoryReply = z.infer<typeof StoryReplySchema>;
export type StoryReplyCreate = z.infer<typeof StoryReplyCreateSchema>;

// Follow validators
export const FollowSchema = z.object({
  id: z.string().uuid(),
  follower: z.string().uuid(),
  following: z.string().uuid(),
  created_at: z.string().datetime().optional(),
});

export const FollowCreateSchema = FollowSchema.omit({ id: true, created_at: true });

export type Follow = z.infer<typeof FollowSchema>;
export type FollowCreate = z.infer<typeof FollowCreateSchema>;

// Comment validators
export const CommentSchema = z.object({
  id: z.string().uuid(),
  post_id: z.string().uuid(),
  author: z.string().uuid(),
  content: z.string().min(1).max(1000),
  created_at: z.string().datetime().optional(),
});

export const CommentCreateSchema = CommentSchema.omit({ id: true, created_at: true });

export type Comment = z.infer<typeof CommentSchema>;
export type CommentCreate = z.infer<typeof CommentCreateSchema>;

// Like validators
export const LikeSchema = z.object({
  id: z.string().uuid(),
  target_type: z.enum(["post", "comment", "listing"]),
  target_id: z.string().uuid(),
  author: z.string().uuid(),
  created_at: z.string().datetime().optional(),
});

export const LikeCreateSchema = LikeSchema.omit({ id: true, created_at: true });

export type Like = z.infer<typeof LikeSchema>;
export type LikeCreate = z.infer<typeof LikeCreateSchema>;

// Listing validators
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const ListingSchema = z.object({
  id: z.string().uuid(),
  vendor: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  price: z.number().min(0).max(9999999.99),
  currency: z.string().default("USD"),
  images: z.array(z.string().url()).default([]),
  quantity: z.number().int().min(0).default(0),
  category: z.string().optional(),
  location: LocationSchema.optional(),
  active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const ListingCreateSchema = z.object({
  vendor: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  price: z.number().min(0).max(9999999.99),
  currency: z.string().default("USD"),
  category: z.string().min(1),
  images: z.array(z.string().url()).optional().default([]),
  quantity: z.number().int().min(0).optional().default(0),
  location: LocationSchema.optional(),
  active: z.boolean().optional().default(true),
});
export const ListingUpdateSchema = ListingCreateSchema.partial();

export type Listing = z.infer<typeof ListingSchema>;
export type ListingCreate = z.infer<typeof ListingCreateSchema>;
export type ListingUpdate = z.infer<typeof ListingUpdateSchema>;
export type Location = z.infer<typeof LocationSchema>;

// Order validators
export const OrderSchema = z.object({
  id: z.string().uuid(),
  buyer: z.string().uuid().optional().nullable(),
  vendor: z.string().uuid().optional().nullable(),
  status: z.enum(["pending", "paid", "shipped", "completed", "refunded", "canceled"]).default("pending"),
  total: z.number().min(0),
  currency: z.string().default("USD"),
  stripe_payment_intent: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const OrderCreateSchema = OrderSchema.omit({ id: true, created_at: true, updated_at: true });
export const OrderUpdateSchema = OrderCreateSchema.partial();

export type Order = z.infer<typeof OrderSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;

// Order Item validators
export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  listing_id: z.string().uuid().optional().nullable(),
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  created_at: z.string().datetime().optional(),
});

export const OrderItemCreateSchema = OrderItemSchema.omit({ id: true, created_at: true });

export type OrderItem = z.infer<typeof OrderItemSchema>;
export type OrderItemCreate = z.infer<typeof OrderItemCreateSchema>;

// Booking validators
export const BookingSchema = z.object({
  id: z.string().uuid(),
  listing_id: z.string().uuid(),
  buyer: z.string().uuid().optional().nullable(),
  vendor: z.string().uuid().optional().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: z.enum(["pending", "confirmed", "canceled", "completed"]).default("pending"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
}).refine((data) => new Date(data.end_time) > new Date(data.start_time), {
  message: "End time must be after start time",
  path: ["end_time"],
});

export const BookingCreateSchema = z.object({
  listing_id: z.string().uuid(),
  buyer: z.string().uuid().optional().nullable(),
  vendor: z.string().uuid().optional().nullable(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: z.enum(["pending", "confirmed", "canceled", "completed"]).default("pending"),
}).refine((data) => new Date(data.end_time) > new Date(data.start_time), {
  message: "End time must be after start time",
  path: ["end_time"],
});

export const BookingUpdateSchema = BookingCreateSchema.partial();

export type Booking = z.infer<typeof BookingSchema>;
export type BookingCreate = z.infer<typeof BookingCreateSchema>;
export type BookingUpdate = z.infer<typeof BookingUpdateSchema>;

// Message validators
export const MessageSchema = z.object({
  id: z.string().uuid(),
  channel_id: z.string(),
  sender: z.string().uuid().optional().nullable(),
  body: z.string().min(1).max(5000).optional(),
  attachments: z.array(z.string().url()).default([]),
  read: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
});

export const MessageCreateSchema = MessageSchema.omit({ id: true, created_at: true });

export type Message = z.infer<typeof MessageSchema>;
export type MessageCreate = z.infer<typeof MessageCreateSchema>;

// Notification validators
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  data: z.record(z.string(), z.any()).optional().nullable(),
  read: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

// Badge validators
export const BadgeSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export type Badge = z.infer<typeof BadgeSchema>;

// Auth validators
export const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  display_name: z.string().min(1).max(100).optional(),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const OnboardingSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  display_name: z.string().min(1, "Display name is required").max(100),
  bio: z.string().max(500).optional().or(z.literal("")),
  avatar_url: z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable()).optional(),
  is_vendor: z.boolean().default(false),
});

// Vendor Profile validators
export const VendorProfileSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().min(1).max(200),
  business_email: z.string().email().optional().nullable(),
  business_phone: z.string().optional().nullable(),
  business_address: z.record(z.string(), z.any()).default({}).optional(),
  tax_id_hash: z.string().optional().nullable(),
  documents: z.array(z.record(z.string(), z.any())).default([]),
  payout_account_id: z.string().optional().nullable(),
  payout_balance: z.number().default(0),
  stripe_onboard_status: z.enum(['not_started', 'pending', 'active', 'restricted']).default('not_started'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const VendorProfileCreateSchema = VendorProfileSchema.omit({ id: true, created_at: true, updated_at: true });
export const VendorProfileUpdateSchema = VendorProfileCreateSchema.partial();

export type VendorProfile = z.infer<typeof VendorProfileSchema>;
export type VendorProfileCreate = z.infer<typeof VendorProfileCreateSchema>;
export type VendorProfileUpdate = z.infer<typeof VendorProfileUpdateSchema>;

// Group validators
export const GroupSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  owner: z.string().uuid().optional().nullable(),
  is_public: z.boolean().default(true),
  avatar_url: z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable()).optional(),
  cover_image_url: z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable()).optional(),
  member_count: z.number().int().default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const GroupCreateSchema = GroupSchema.omit({ id: true, member_count: true, created_at: true, updated_at: true });
export const GroupUpdateSchema = GroupCreateSchema.partial();

export type Group = z.infer<typeof GroupSchema>;
export type GroupCreate = z.infer<typeof GroupCreateSchema>;
export type GroupUpdate = z.infer<typeof GroupUpdateSchema>;

// Group Member validators
export const GroupMemberSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'moderator', 'member']).default('member'),
  joined_at: z.string().datetime().optional(),
});

export const GroupMemberCreateSchema = GroupMemberSchema.omit({ id: true, joined_at: true });

export type GroupMember = z.infer<typeof GroupMemberSchema>;
export type GroupMemberCreate = z.infer<typeof GroupMemberCreateSchema>;

// Store Profile validators
export const StoreProfileSchema = z.object({
  id: z.string().uuid(),
  vendor_profile_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  images: z.array(z.string().url()).default([]),
  categories: z.array(z.string()).default([]),
  location: z.record(z.string(), z.any()).default({}).optional(),
  rating: z.number().min(0).max(5).default(0),
  reviews_count: z.number().int().default(0),
  is_featured: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const StoreProfileCreateSchema = StoreProfileSchema.omit({ id: true, rating: true, reviews_count: true, created_at: true, updated_at: true });
export const StoreProfileUpdateSchema = StoreProfileCreateSchema.partial();

export type StoreProfile = z.infer<typeof StoreProfileSchema>;
export type StoreProfileCreate = z.infer<typeof StoreProfileCreateSchema>;
export type StoreProfileUpdate = z.infer<typeof StoreProfileUpdateSchema>;

// Transaction validators
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['order', 'payout', 'refund', 'fee', 'commission']),
  user_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  amount: z.number(),
  currency: z.string().default('USD'),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('pending'),
  metadata: z.record(z.string(), z.any()).default({}).optional(),
  stripe_payment_intent_id: z.string().optional().nullable(),
  stripe_transfer_id: z.string().optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Payout validators
export const PayoutSchema = z.object({
  id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  vendor_profile_id: z.string().uuid(),
  stripe_payout_id: z.string().optional().nullable(),
  amount: z.number(),
  currency: z.string().default('USD'),
  status: z.enum(['pending', 'paid', 'failed', 'cancelled']).default('pending'),
  payout_method: z.string().optional().nullable(),
  metadata: z.record(z.any()).default({}).optional(),
  processed_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Payout = z.infer<typeof PayoutSchema>;

// Review validators
export const ReviewSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  buyer: z.string().uuid().optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(2000).optional().nullable(),
  images: z.array(z.string().url()).default([]),
  is_verified_purchase: z.boolean().default(false),
  helpful_count: z.number().int().default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const ReviewCreateSchema = ReviewSchema.omit({ id: true, helpful_count: true, created_at: true, updated_at: true });
export const ReviewUpdateSchema = ReviewCreateSchema.partial();

export type Review = z.infer<typeof ReviewSchema>;
export type ReviewCreate = z.infer<typeof ReviewCreateSchema>;
export type ReviewUpdate = z.infer<typeof ReviewUpdateSchema>;

// User Points validators
export const UserPointsSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  points: z.number().int(),
  reason: z.string(),
  metadata: z.record(z.any()).default({}).optional(),
  awarded_at: z.string().datetime().optional(),
});

export type UserPoints = z.infer<typeof UserPointsSchema>;

// Vendor Application (for onboarding form - simplified for initial submission)
export const VendorApplicationSchema = z.object({
  business_name: z.string().min(1).max(200),
  business_email: z.string().email(),
  business_phone: z.string().optional(),
  business_address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().default('US'),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
  documents: z.array(z.object({
    type: z.string(), // 'business_license', 'tax_id', 'id'
    url: z.string().url(),
    filename: z.string(),
    uploaded_at: z.string().datetime().optional(),
  })).default([]),
});

export type SignUp = z.infer<typeof SignUpSchema>;
export type SignIn = z.infer<typeof SignInSchema>;
export type Onboarding = z.infer<typeof OnboardingSchema>;
export type VendorApplication = z.infer<typeof VendorApplicationSchema>;

// Cart item (client-side only)
export const CartItemSchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  listing: ListingSchema.optional(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

// News validators
export const NewsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional().nullable(),
  image_url: z.preprocess((v) => (v === '' ? null : v), z.string().url().nullable()).optional(),
  author: z.string().uuid().optional().nullable(),
  category: z.enum(['announcement', 'update', 'feature', 'community']).default('announcement'),
  is_pinned: z.boolean().default(false),
  is_published: z.boolean().default(true),
  view_count: z.number().int().default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const NewsCreateSchema = NewsSchema.omit({ id: true, view_count: true, created_at: true, updated_at: true });
export const NewsUpdateSchema = NewsCreateSchema.partial();

export type News = z.infer<typeof NewsSchema>;
export type NewsCreate = z.infer<typeof NewsCreateSchema>;
export type NewsUpdate = z.infer<typeof NewsUpdateSchema>;

// Leaderboard validators
export const LeaderboardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  period: z.enum(['daily', 'weekly', 'monthly', 'all_time']).default('all_time'),
  points: z.number().int().default(0),
  rank: z.number().int().optional().nullable(),
  calculated_at: z.string().datetime().optional(),
});

export type Leaderboard = z.infer<typeof LeaderboardSchema>;

