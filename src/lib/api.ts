import { supabase } from "@/integrations/supabase/client";
import { resolveApiUrl } from "./api-url";
import { ApiError } from "./types";
import { mockApi, shouldUseMockApi } from "./api-mock";
import { sanitizeString } from "./sanitize";
import { logger } from "./logger";
import { unwrapApiData } from "./api-response";
import type {
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
  Order,
  OrderCreate,
  Booking,
  BookingCreate,
  Message,
  MessageCreate,
  Notification,
  VendorProfile,
  VendorProfileCreate,
  VendorProfileUpdate,
  VendorApplication,
  News,
  NewsCreate,
  NewsUpdate,
  Group,
  GroupCreate,
  GroupUpdate,
  GroupMember,
  GroupMemberCreate,
  Badge,
  Leaderboard,
  Story,
  StoryCreate,
  StoryViewCreate,
  StoryReplyCreate,
} from "./types";

export interface Ad {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  cta_text?: string | null;
  cta_url?: string | null;
  placements: string[];
  is_active: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string | null;
}

export interface Hashtag {
  id: string;
  tag: string;
  usage_count?: number;
  trending_score?: number;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  vote_count: number;
}

export interface PollWithOptions {
  id: string;
  post_id: string;
  question: string;
  expires_at?: string | null;
  options?: PollOption[];
}


// Helper to handle Supabase errors
function handleError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  
  // Handle network errors (Failed to fetch)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    throw new ApiError(
      "Network error. Please check your connection and try again.",
      "NETWORK_ERROR",
      0
    );
  }
  
  // Handle Supabase errors
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as { message?: string; code?: string; status?: number; details?: string; hint?: string };
    const message = supabaseError.message || "An unexpected error occurred";
    
    // Handle schema cache errors - table not found in schema cache
    if (message.includes("Could not find the table") || message.includes("schema cache") || message.includes("relation") && message.includes("does not exist")) {
      throw new ApiError(
        `Database schema error: ${message}. Please ensure your Supabase migrations have been applied and the schema is up to date.`,
        "SCHEMA_ERROR",
        500
      );
    }
    
    throw new ApiError(
      message,
      supabaseError.code,
      supabaseError.status
    );
  }
  
  throw new ApiError(
    "An unexpected error occurred",
    "UNKNOWN_ERROR",
    500
  );
}

// Profile API

function parseProfileFromApiResponse(result: {
  success?: boolean
  data?: Profile
  profile?: Profile
}): Profile {
  const profile = result.data ?? result.profile
  if (!profile) {
    throw new ApiError(
      'Invalid profile response from server',
      'INVALID_RESPONSE',
      500
    )
  }
  return profile as Profile
}

async function getSessionUserId(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

/** Fetch the authenticated user's profile via API (bypasses RLS / fallback issues). */
export async function getMyProfile(): Promise<Profile | null> {
  if (shouldUseMockApi()) {
    const sessionUserId = await getSessionUserId()
    if (!sessionUserId) return null
    return mockApi.getProfile(sessionUserId)
  }

  const response = await fetch(resolveApiUrl('/api/profile/me'), {
    credentials: 'include',
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch profile' }))
    throw new ApiError(
      errorData.error || 'Failed to fetch profile',
      errorData.code || 'PROFILE_FETCH_FAILED',
      response.status
    )
  }

  const result = await response.json()
  return parseProfileFromApiResponse(result)
}

export async function getProfile(userId: string): Promise<Profile> {
  if (shouldUseMockApi()) {
    try {
      return await mockApi.getProfile(userId)
    } catch {
      return mockApi.getProfile(userId)
    }
  }

  const sessionUserId = await getSessionUserId()
  if (sessionUserId && sessionUserId === userId) {
    const ownProfile = await getMyProfile()
    if (ownProfile) {
      return ownProfile
    }
    throw new ApiError('Profile not found', 'NOT_FOUND', 404)
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      handleError(error)
    }

    if (!data) {
      throw new ApiError('Profile not found', 'NOT_FOUND', 404)
    }

    return data as Profile
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error
    }
    throw error
  }
}

// CLERK MIGRATION: Updated to use API route with Clerk authentication
export async function updateProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  try {
    const response = await fetch(resolveApiUrl('/api/profile/update'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for Supabase session
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      
      // Handle specific error types
      if (errorData.type === 'USERNAME_TAKEN') {
        throw new ApiError(
          errorData.error || `Username is already taken. Please choose a different username.`,
          "USERNAME_TAKEN",
          400
        );
      }
      
      if (errorData.type === 'PERMISSION_DENIED') {
        throw new ApiError(
          errorData.error || "Permission denied. Please ensure you have permission to update this profile.",
          "PERMISSION_DENIED",
          403
        );
      }
      
      if (errorData.type === 'PROFILE_UPDATE_FAILED' || errorData.type === 'PROFILE_CREATE_FAILED') {
        throw new ApiError(
          errorData.error || "Failed to update profile. Please try again.",
          "PROFILE_UPDATE_FAILED",
          400
        );
      }
      
      throw new ApiError(
        errorData.error || errorData.details || "Failed to update profile",
        errorData.type || "UNKNOWN_ERROR",
        response.status
      );
    }

    const result = await response.json();
    return parseProfileFromApiResponse(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        "Network error. Please check your connection and try again.",
        "NETWORK_ERROR",
        0
      );
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : "Failed to update profile",
      "UNKNOWN_ERROR",
      500
    );
  }
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("username", `%${query}%`)
    .limit(20);

  if (error) handleError(error);
  return (data || []) as Profile[];
}

// Posts API
export async function getPost(postId: string): Promise<Post> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (error) handleError(error);
  if (!data) {
    throw new ApiError("Post not found", "NOT_FOUND", 404);
  }
  return data as Post;
}

export async function createPost(post: PostCreate & { mentions?: string[] }): Promise<Post> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  // This ensures proper authentication and uses admin client
  try {
    const response = await fetch(resolveApiUrl('/api/posts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
      body: JSON.stringify(post),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create post' }));
      throw new ApiError(
        errorData.message || errorData.error || 'Failed to create post',
        errorData.code || 'POST_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return unwrapApiData<Post>(result);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error creating post', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to create post',
      'POST_CREATE_FAILED',
      500
    );
  }
}

export async function updatePost(postId: string, updates: PostUpdate): Promise<Post> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  try {
    const response = await fetch(resolveApiUrl(`/api/posts/${postId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update post' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to update post',
        errorData.code || 'POST_UPDATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as Post;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error updating post', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to update post',
      'POST_UPDATE_FAILED',
      500
    );
  }
}

export async function deletePost(postId: string): Promise<void> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  try {
    const response = await fetch(resolveApiUrl(`/api/posts/${postId}`), {
      method: 'DELETE',
      credentials: 'include', // Include cookies for Supabase session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete post' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to delete post',
        errorData.code || 'POST_DELETE_FAILED',
        response.status
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error deleting post', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to delete post',
      'POST_DELETE_FAILED',
      500
    );
  }
}

export async function getFeedPosts(page: number = 0, pageSize: number = 20): Promise<Post[]> {
  // CLERK MIGRATION: Use API route for better authentication and data consistency
  try {
    const offset = page * pageSize;
    const response = await fetch(resolveApiUrl(`/api/posts?limit=${pageSize}&offset=${offset}`), {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch posts' }));
      throw new ApiError(
        errorData.error || 'Failed to fetch posts',
        'FEED_FETCH_ERROR',
        response.status
      );
    }

    const result = await response.json();
    return (result.posts || []) as Post[];
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error fetching feed posts', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to fetch posts',
      'FEED_FETCH_ERROR',
      500
    );
  }
}

export async function getAdsByPlacement(placement: string): Promise<Ad[]> {
  const response = await fetch(resolveApiUrl(`/api/ads?placement=${encodeURIComponent(placement)}`), {
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to load ads" }));
    throw new ApiError(errorData.error || "Failed to load ads", "ADS_FETCH_ERROR", response.status);
  }

  const result = await response.json();
  return (result.data || []) as Ad[];
}

export async function getAllAds(): Promise<Ad[]> {
  const response = await fetch(resolveApiUrl(`/api/ads?all=true`), {
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to load ads" }));
    throw new ApiError(errorData.error || "Failed to load ads", "ADS_FETCH_ERROR", response.status);
  }

  const result = await response.json();
  return (result.data || []) as Ad[];
}

export async function createAdEntry(ad: Partial<Ad> & { title: string; placements: string[] }): Promise<Ad> {
  const response = await fetch(resolveApiUrl(`/api/ads`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(ad),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to create ad" }));
    throw new ApiError(errorData.error || "Failed to create ad", "ADS_CREATE_ERROR", response.status);
  }

  const result = await response.json();
  return result.data as Ad;
}

export async function updateAdEntry(id: string, updates: Partial<Ad>): Promise<Ad> {
  const response = await fetch(resolveApiUrl(`/api/ads/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to update ad" }));
    throw new ApiError(errorData.error || "Failed to update ad", "ADS_UPDATE_ERROR", response.status);
  }

  const result = await response.json();
  return result.data as Ad;
}

export async function deleteAdEntry(id: string): Promise<void> {
  const response = await fetch(resolveApiUrl(`/api/ads/${id}`), {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to delete ad" }));
    throw new ApiError(errorData.error || "Failed to delete ad", "ADS_DELETE_ERROR", response.status);
  }
}

export async function getTrendingHashtags(limit: number = 10): Promise<Hashtag[]> {
  const { data, error } = await supabase
    .from("hashtags")
    .select("*")
    .order("trending_score", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []) as Hashtag[];
}

export async function getFollowSuggestions(limit: number = 6): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("followers_count", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []) as Profile[];
}

export async function getActivePolls(limit: number = 3): Promise<PollWithOptions[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("polls")
    .select(`
      *,
      options:poll_options(*)
    `)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []) as PollWithOptions[];
}

export async function voteOnPoll(pollId: string, optionId: string): Promise<void> {
  const response = await fetch(resolveApiUrl(`/api/polls/${pollId}/vote`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ optionId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Failed to vote" }));
    throw new ApiError(errorData.error || "Failed to vote", "POLL_VOTE_ERROR", response.status);
  }
}

export async function getUserPosts(userId: string, page: number = 0, pageSize: number = 20): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author", userId)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Post[];
}

// Follows API
export async function followUser(follow: FollowCreate): Promise<Follow> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  try {
    const response = await fetch(resolveApiUrl(`/api/users/${follow.following}/follow`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to follow user' }));
      throw new ApiError(
        errorData.error || 'Failed to follow user',
        errorData.code || 'FOLLOW_ERROR',
        response.status
      );
    }

    const result = await response.json();
    // Return a mock Follow object since the API doesn't return the full follow object
    return {
      id: '',
      follower: '',
      following: follow.following,
      created_at: new Date().toISOString(),
    } as Follow;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error following user', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to follow user',
      'FOLLOW_ERROR',
      500
    );
  }
}

export async function unfollowUser(followingId: string): Promise<void> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  try {
    const response = await fetch(resolveApiUrl(`/api/users/${followingId}/follow`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to unfollow user' }));
      throw new ApiError(
        errorData.error || 'Failed to unfollow user',
        errorData.code || 'UNFOLLOW_ERROR',
        response.status
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error unfollowing user', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to unfollow user',
      'UNFOLLOW_ERROR',
      500
    );
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  // CLERK MIGRATION: Use API route to check follow status
  // Note: followerId should be the current user's profile UUID, followingId is the target profile UUID
  try {
    const response = await fetch(resolveApiUrl(`/api/users/${followingId}/follow?check=true`), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
    });

    if (!response.ok) {
      // If not found, return false
      if (response.status === 404) return false;
      const errorData = await response.json().catch(() => ({ error: 'Failed to check follow status' }));
      throw new ApiError(
        errorData.error || 'Failed to check follow status',
        errorData.code || 'FOLLOW_CHECK_ERROR',
        response.status
      );
    }

    const result = await response.json();
    return result.isFollowing || false;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error checking follow status', error);
    // Fallback to false if error
    return false;
  }
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower, profiles!follows_follower_fkey(*)")
    .eq("following", userId);

  if (error) handleError(error);
  return (data || []).map((item: any) => item.profiles) as Profile[];
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  if (shouldUseMockApi()) {
    return await mockApi.getFollowing(userId);
  }

  try {
    const { data, error } = await supabase
      .from("follows")
      .select("following, profiles!follows_following_fkey(*)")
      .eq("follower", userId);

    if (error) {
      if (shouldUseMockApi() || error.status === 401) {
        return await mockApi.getFollowing(userId);
      }
      handleError(error);
    }
    return (data || []).map((item: { profiles: Profile }) => item.profiles) as Profile[];
  } catch (error: unknown) {
    const errorStatus = error && typeof error === 'object' && 'status' in error ? (error.status as number) : undefined
    if (shouldUseMockApi() || errorStatus === 401) {
      return await mockApi.getFollowing(userId);
    }
    throw error;
  }
}

// Comments API
export async function getPostComments(postId: string, limit: number = 100): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit); // Add pagination limit to prevent loading too many comments

  if (error) handleError(error);
  return (data || []) as Comment[];
}

export async function createComment(comment: CommentCreate & { mentions?: string[] }): Promise<Comment> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  try {
    console.log('Creating comment:', { post_id: comment.post_id, content: comment.content });
    
    const url = `/api/posts/${comment.post_id}/comments`;
    console.log('Fetching URL:', url);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for Supabase session
        body: JSON.stringify({
          content: comment.content,
          parent_id: comment.parent_id || null,
          mentions: comment.mentions || [],
        }),
      });
    } catch (fetchError) {
      console.error('Fetch error (network issue):', fetchError);
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        throw new ApiError(
          'Network error. Please check your internet connection and make sure the server is running.',
          'NETWORK_ERROR',
          0
        );
      }
      throw fetchError;
    }

    console.log('Comment response status:', response.status, response.statusText);
    console.log('Comment response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to get error message from response
      let errorData: any = {};
      let errorText = '';
      
      try {
        // First, try to get the response as text to see what we're actually getting
        const responseClone = response.clone();
        errorText = await responseClone.text();
        console.error('Raw error response text:', errorText);
        
        // Now try to parse as JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = JSON.parse(errorText);
            console.error('Parsed error data:', errorData);
          } catch (parseError) {
            console.error('Failed to parse error as JSON:', parseError);
            errorData = { error: errorText || 'Failed to create comment', raw: errorText };
          }
        } else {
          errorData = { error: errorText || 'Failed to create comment', raw: errorText };
        }
      } catch (e) {
        console.error('Failed to read error response:', e);
        errorData = { 
          error: `Server error (${response.status})`, 
          message: `Server returned status ${response.status}`,
          raw: String(e)
        };
      }
      
      console.error('Comment creation error:', errorData);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // If errorData is empty, provide a default error message
      if (!errorData || Object.keys(errorData).length === 0) {
        errorData = {
          error: `Server error (${response.status})`,
          message: `The server returned an error but no error details. Status: ${response.status}`,
          code: 'EMPTY_ERROR_RESPONSE'
        };
      }
      
      throw new ApiError(
        errorData.error || errorData.message || `Failed to create comment (${response.status})`,
        errorData.code || 'COMMENT_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    console.log('Comment creation result:', result);
    // API returns { data: comment, message: ... }
    if (result.data) {
      return result.data as Comment;
    }
    // Fallback
    if (result.comment) {
      return result.comment as Comment;
    }
    throw new ApiError('Invalid response format from comment API', 'INVALID_RESPONSE', 500);
  } catch (error) {
    console.error('Comment creation exception:', error);
    if (error instanceof ApiError) throw error;
    
    logger.error('Error creating comment', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to create comment',
      'COMMENT_CREATE_FAILED',
      500
    );
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  // CLERK MIGRATION: Use API route instead of direct Supabase call
  // First, we need to get the post_id for the comment to construct the URL
  // For now, we'll need to fetch the comment first or modify the API to accept commentId directly
  try {
    // Get comment to find post_id
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", commentId)
      .single();

    if (fetchError || !comment) {
      throw new ApiError("Comment not found.", "NOT_FOUND", 404);
    }

    // Delete via API route
    const response = await fetch(resolveApiUrl(`/api/posts/${comment.post_id}/comments?commentId=${commentId}`), {
      method: 'DELETE',
      credentials: 'include', // Include cookies for Supabase session
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete comment' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to delete comment',
        errorData.code || 'COMMENT_DELETE_FAILED',
        response.status
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    logger.error('Error deleting comment', error);
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to delete comment',
      'COMMENT_DELETE_FAILED',
      500
    );
  }
}

// Likes API - Using new reactions system
// CLERK MIGRATION: Removed Supabase auth check - API route handles authentication
export async function like(targetType: "post" | "comment" | "listing", targetId: string): Promise<Like> {
  // Use new reaction API for posts
  if (targetType === "post") {
    const response = await fetch(resolveApiUrl('/api/posts/react'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
      body: JSON.stringify({ postId: targetId, reaction: 'like' }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to like post" }));
      throw new ApiError(error.error || "Failed to like post", "LIKE_ERROR", response.status);
    }
    
    return { id: targetId, target_type: targetType, target_id: targetId, author: '', created_at: new Date().toISOString() } as Like;
  }

  // Fallback to old likes table for comments and listings
  // CLERK MIGRATION: Use API route for these as well, or create separate routes
  // For now, we'll use direct Supabase call but this should be migrated to API routes
  const { data, error } = await supabase
    .from("likes")
    .insert({
      target_type: targetType,
      target_id: targetId,
      author: '', // This will need to be fixed when we migrate to API routes
    })
    .select()
    .single();

  if (error) handleError(error);
  return data as Like;
}

export async function unlike(targetType: "post" | "comment" | "listing", targetId: string): Promise<void> {
  // CLERK MIGRATION: Use API route for posts
  if (targetType === "post") {
    const response = await fetch(resolveApiUrl('/api/posts/react'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for Supabase session
      body: JSON.stringify({ postId: targetId }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to unlike post" }));
      throw new ApiError(error.error || "Failed to unlike post", "UNLIKE_ERROR", response.status);
    }
    return;
  }

  // Fallback to old likes table for comments and listings
  // CLERK MIGRATION: This should also use API routes
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) handleError(error);
}

export async function getLikeCount(targetType: "post" | "comment" | "listing", targetId: string): Promise<number> {
  // Use API route for posts (avoids RLS issues with Clerk)
  if (targetType === "post") {
    try {
      const response = await fetch(resolveApiUrl(`/api/posts/${targetId}/reactions/count`));
      if (!response.ok) {
        console.error("Get like count error: API returned", response.status);
        return 0;
      }
      const data = await response.json();
      return data.data?.count || 0;
    } catch (error) {
      console.error("Get like count error:", error);
      return 0;
    }
  }

  // Fallback to old likes table for comments and listings
  const { count, error } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) handleError(error);
  return count || 0;
}

export async function isLiked(targetType: "post" | "comment" | "listing", targetId: string): Promise<boolean> {
  // CLERK MIGRATION: Use API route for posts to check if user has reacted
  if (targetType === "post") {
    try {
      const response = await fetch(resolveApiUrl(`/api/posts/react?postId=${targetId}`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for Supabase session
      });
      
      if (!response.ok) {
        // If unauthorized or not found, return false
        return false;
      }
      
      const data = await response.json();
      return data.isLiked || false;
    } catch (error) {
      console.error("isLiked error:", error);
      return false;
    }
  }

  // Fallback to old likes table for comments and listings
  // CLERK MIGRATION: This should also use API routes
  const { data, error } = await supabase
    .from("likes")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return false;
  }

  return !!data;
}

// Listings API
export async function getListing(listingId: string): Promise<Listing> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();

  if (error) handleError(error);
  return data as Listing;
}

export async function createListing(listing: ListingCreate): Promise<Listing> {
  try {
    const payload: any = { ...listing };
    if (payload.media_urls) {
      payload.images = payload.media_urls;
      delete payload.media_urls;
    }

    const response = await fetch(resolveApiUrl("/api/listings"), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      credentials: "include", // Critical: Include cookies for Clerk authentication
      cache: "no-store", // Prevent caching issues with authentication
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        const errorText = await response.text().catch(() => "Failed to create listing");
        errorData = { error: errorText, message: errorText };
      }
      
      // Preserve error details (like listing limit info) in the error object
      const error = new ApiError(
        errorData.error || errorData.message || "Failed to create listing",
        errorData.code || "LISTING_CREATE_FAILED",
        response.status
      );
      
      // Attach additional error details if available (for listing limit errors)
      if (errorData.details) {
        (error as any).details = typeof errorData.details === 'object' 
          ? errorData.details 
          : { message: errorData.details };
      }
      
      // Also check if details are in the root of errorData
      if (errorData.currentLimit || errorData.tier || errorData.currentCount) {
        (error as any).details = {
          ...((error as any).details || {}),
          currentLimit: errorData.currentLimit || errorData.details?.currentLimit,
          limit: errorData.currentLimit || errorData.details?.currentLimit,
          currentCount: errorData.currentCount || errorData.details?.currentCount,
          tier: errorData.tier || errorData.details?.tier,
          message: errorData.details?.message || errorData.message || errorData.error,
        };
      }
      
      throw error;
    }

    const result = await response.json();
    return (result.data?.listing || result.listing || result.data) as Listing;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function updateListing(listingId: string, updates: ListingUpdate): Promise<Listing> {
  try {
    const payload: any = { ...updates };
    if (payload.media_urls) {
      payload.images = payload.media_urls;
      delete payload.media_urls;
    }

    const response = await fetch(resolveApiUrl(`/api/listings/${listingId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to update listing" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to update listing",
        errorData.code || "LISTING_UPDATE_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return (result.data?.listing || result.listing || result.data) as Listing;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function deleteListing(listingId: string): Promise<void> {
  try {
    const response = await fetch(resolveApiUrl(`/api/listings/${listingId}`), {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to delete listing" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to delete listing",
        errorData.code || "LISTING_DELETE_FAILED",
        response.status
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function getListings(page: number = 0, pageSize: number = 20, category?: string): Promise<Listing[]> {
  try {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    if (category) params.append('category', category)

    const response = await fetch(resolveApiUrl(`/api/listings?${params.toString()}`), {
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch listings' }))
      throw new ApiError(
        errorData.error || 'Failed to fetch listings',
        errorData.code || 'LISTINGS_FETCH_FAILED',
        response.status
      )
    }

    const result = await response.json()
    return (result.data?.listings || result.listings || []) as Listing[]
  } catch (error) {
    if (error instanceof ApiError) throw error
    handleError(error)
    return []
  }
}

export async function searchListings(query: string, page: number = 0, pageSize: number = 20): Promise<Listing[]> {
  try {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())
    params.append('search', query)

    const response = await fetch(resolveApiUrl(`/api/listings?${params.toString()}`), {
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to search listings' }))
      throw new ApiError(
        errorData.error || 'Failed to search listings',
        errorData.code || 'LISTINGS_SEARCH_FAILED',
        response.status
      )
    }

    const result = await response.json()
    return (result.data?.listings || result.listings || []) as Listing[]
  } catch (error) {
    if (error instanceof ApiError) throw error
    handleError(error)
    return []
  }
}

export async function searchPosts(query: string, page: number = 0, pageSize: number = 20): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("visibility", "public")
    .ilike("content", `%${query}%`)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Post[];
}

export async function getVendorListings(vendorId: string): Promise<Listing[]> {
  // Use API route for better consistency and to handle both Clerk IDs and UUIDs
  try {
    const response = await fetch(resolveApiUrl(`/api/listings?vendor=${vendorId}`), {
      credentials: 'include',
    });
    
    if (!response.ok) {
      // Fallback to direct Supabase query if API fails
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("vendor", vendorId)
        .order("created_at", { ascending: false });

      if (error) handleError(error);
      return (data || []) as Listing[];
    }
    
    const result = await response.json();
    const listings = result.data?.listings || result.listings || [];
    return listings as Listing[];
  } catch (error) {
    // Fallback to direct Supabase query on error
    const { data, error: supabaseError } = await supabase
      .from("listings")
      .select("*")
      .eq("vendor", vendorId)
      .order("created_at", { ascending: false });

    if (supabaseError) handleError(supabaseError);
    return (data || []) as Listing[];
  }
}

// Orders API (read-only for client, creation via Edge Function)
export async function getOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) handleError(error);
  return data as Order;
}

export async function getUserOrders(userId?: string, limit: number = 50): Promise<Order[]> {
  // CLERK MIGRATION: Use direct Supabase query with profile UUID
  // Note: This assumes userId is a profile UUID, not a Clerk ID
  // If userId is not provided, we need to get it from the current user's profile
  let targetUserId = userId;

  if (!targetUserId) {
    // Get current user's profile UUID from Clerk
    // This is a workaround - ideally we'd have an API route for this
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", (await supabase.auth.getSession()).data.session?.user?.id || "")
        .maybeSingle();
      
      if (!profile?.id) {
        throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);
      }
      targetUserId = profile.id;
    } catch {
      // Fallback: try to use the session user ID directly (if it's already a profile UUID)
      const session = await supabase.auth.getSession();
      if (!session.data.session?.user?.id) {
        throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);
      }
      // This might be a Clerk ID, so we need to look it up
      // For now, throw an error - this function needs an API route
      throw new ApiError(
        "Please provide a profile UUID. This function needs to be migrated to use an API route.",
        "MIGRATION_NEEDED",
        500
      );
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .or(`buyer.eq.${targetUserId},vendor.eq.${targetUserId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []) as Order[];
}

export async function getOrderItems(orderId: string): Promise<Array<OrderItem & { listing?: Listing }>> {
  const { data, error } = await supabase
    .from("order_items")
    .select(`
      *,
      listing:listings(*)
    `)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) handleError(error);
  return (data || []) as Array<OrderItem & { listing?: Listing }>;
}

/**
 * Update order status (vendor can update their orders)
 */
export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order> {
  try {
    const response = await fetch(resolveApiUrl(`/api/orders/${orderId}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update order' }));
      throw new ApiError(
        errorData.error || "Failed to update order",
        errorData.type || "ORDER_UPDATE_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return result.data as Order;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to update order", "ORDER_UPDATE_FAILED", 500);
  }
}

// Bookings API
export async function getListingAvailability(
  listingId: string,
  date?: string,
  days?: number
): Promise<{
  listing_id: string
  date_range: { start: string; end: string }
  availability: Array<{
    date: string
    timeSlots: Array<{ start: string; end: string; available: boolean }>
  }>
  summary: {
    total_slots: number
    available_slots: number
    booked_slots: number
  }
}> {
  try {
    const params = new URLSearchParams()
    if (date) params.append('date', date)
    if (days) params.append('days', days.toString())

    const response = await fetch(resolveApiUrl(`/api/listings/${listingId}/availability?${params.toString()}`), {
      credentials: 'include',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch availability' }))
      throw new ApiError(
        errorData.error || 'Failed to fetch availability',
        'AVAILABILITY_FETCH_ERROR',
        response.status
      )
    }

    const result = await response.json()
    return result.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    
    logger.error('Error fetching listing availability', error)
    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to fetch availability',
      'AVAILABILITY_FETCH_ERROR',
      500
    )
  }
}

export async function getBooking(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (error) handleError(error);
  return data as Booking;
}

export async function createBooking(booking: BookingCreate & { notes?: string }): Promise<Booking> {
  // CLERK MIGRATION: Clerk handles authentication via cookies automatically
  // No need to pass tokens - Clerk middleware handles auth
  
  // Use API route for better error handling
  const response = await fetch(resolveApiUrl("/api/bookings/create"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Clerk handles auth via cookies - no Authorization header needed
    },
    credentials: "include", // Include cookies for Clerk auth
    body: JSON.stringify({
      listing_id: booking.listing_id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      notes: booking.notes,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new ApiError(
      result.error || "Failed to create booking",
      result.code || "BOOKING_ERROR",
      response.status
    );
  }

  // Backend returns: { success: true, data: { booking } }
  // Handle both formats for backward compatibility
  if (result.data?.booking) {
    return result.data.booking as Booking;
  }
  if (result.booking) {
    return result.booking as Booking;
  }
  throw new ApiError("Invalid response format from booking API", "INVALID_RESPONSE", 500);
}

export async function updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking> {
  // CLERK MIGRATION: Use API route - Clerk handles authentication via cookies
  const response = await fetch(resolveApiUrl(`/api/bookings/update?id=${bookingId}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies for Clerk auth
    body: JSON.stringify(updates),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new ApiError(
      result.error || "Failed to update booking",
      result.code || "BOOKING_ERROR",
      response.status
    );
  }

  // Backend returns: { success: true, data: { booking } }
  // Handle both formats for backward compatibility
  if (result.data?.booking) {
    return result.data.booking as Booking;
  }
  if (result.booking) {
    return result.booking as Booking;
  }
  throw new ApiError("Invalid response format from booking API", "INVALID_RESPONSE", 500);
}

export async function getUserBookings(userId?: string, limit: number = 50, role?: 'buyer' | 'vendor'): Promise<Booking[]> {
  // CLERK MIGRATION: Use API route - Clerk handles authentication via cookies
  // The API route automatically uses the authenticated user's ID
  const params = new URLSearchParams();
  if (role) {
    params.append('role', role);
  }
  
  const response = await fetch(resolveApiUrl(`/api/bookings/create?${params.toString()}`), {
    method: "GET",
    credentials: "include", // Include cookies for Clerk auth
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch bookings' }));
    throw new ApiError(
      errorData.error || "Failed to fetch bookings",
      errorData.code || "BOOKING_ERROR",
      response.status
    );
  }

  const result = await response.json();

  // Backend returns: { success: true, data: { bookings: [...] } }
  // Handle both formats for backward compatibility
  if (result.data?.bookings) {
    return (result.data.bookings as Booking[]).slice(0, limit);
  }
  if (result.bookings) {
    return (result.bookings as Booking[]).slice(0, limit);
  }
  return [];
}

// Messages API
export function createChannelId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

export async function getMessages(channelId: string, limit: number = 50): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []).reverse() as Message[];
}

export async function sendMessage(message: MessageCreate): Promise<Message> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Sanitize message content to prevent XSS attacks
  const sanitizedMessage = {
    ...message,
    content: message.content ? sanitizeString(message.content) : "",
    sender: user.id,
  };

  const { data, error } = await supabase
    .from("messages")
    .insert(sanitizedMessage)
    .select()
    .single();

  if (error) handleError(error);
  return data as Message;
}

export async function markMessagesAsRead(channelId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("channel_id", channelId)
    .neq("sender", userId)
    .eq("read", false);

  if (error) handleError(error);
}

// Notifications API
export async function getNotifications(userId?: string, unreadOnly: boolean = false): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const targetUserId = userId || user?.id;
  if (!targetUserId) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) handleError(error);
  return (data || []) as Notification[];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) handleError(error);
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) handleError(error);
}

// Storage helpers
// CLERK MIGRATION: Updated to use API route that bypasses RLS
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Use API route for uploads to bypass RLS policies (Clerk migration)
  // Clerk handles authentication via cookies automatically
  console.log('Uploading file:', { bucket, path, fileName: file.name, fileSize: file.size });
  console.log('Current window location:', window.location.href);
  console.log('Upload URL will be:', window.location.origin + '/api/upload');
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  formData.append('path', path);

  let response: Response;
  try {
    const uploadUrl = '/api/upload';
    const fullUrl = window.location.origin + uploadUrl;
    console.log('Attempting fetch to:', uploadUrl);
    console.log('Full URL:', fullUrl);
    console.log('FormData contents:', Array.from(formData.entries()));
    
    response = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include', // Critical: Include cookies for Clerk authentication
      cache: 'no-store', // Prevent caching issues with authentication
      body: formData,
    });
    
    console.log('Fetch successful, response received:', response.status);
  } catch (fetchError) {
    console.error('Upload fetch error (network issue):', fetchError);
    console.error('Error details:', {
      name: fetchError instanceof Error ? fetchError.name : 'Unknown',
      message: fetchError instanceof Error ? fetchError.message : String(fetchError),
      stack: fetchError instanceof Error ? fetchError.stack : undefined,
    });
    console.error('Browser info:', {
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      port: window.location.port,
    });
    
    if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
      throw new ApiError(
        'Network error. Please check your internet connection and make sure the server is running.',
        'NETWORK_ERROR',
        0
      );
    }
    throw fetchError;
  }

  console.log('Upload response status:', response.status, response.statusText);

  if (!response.ok) {
    let errorData: any = {};
    let errorText = '';
    
    try {
      const responseClone = response.clone();
      errorText = await responseClone.text();
      console.error('Raw upload error response:', errorText);
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          errorData = { error: errorText || 'Upload failed', raw: errorText };
        }
      } else {
        errorData = { error: errorText || 'Upload failed', raw: errorText };
      }
    } catch (e) {
      console.error('Failed to read upload error response:', e);
      errorData = { 
        error: `Server error (${response.status})`, 
        message: `Server returned status ${response.status}`,
        raw: String(e)
      };
    }
    
    console.error('Upload error:', errorData);
    throw new ApiError(
      errorData.error || errorData.message || 'Upload failed',
      errorData.code || 'UPLOAD_ERROR',
      response.status
    );
  }

  const data = await response.json();
  console.log('Upload response:', data);
  
  // Backend returns: { success: true, data: { path, url, publicUrl } }
  // Handle both formats for backward compatibility
  if (data.success && data.data) {
    if (data.data.url) {
      return data.data.url;
    }
    if (data.data.publicUrl) {
      return data.data.publicUrl;
    }
    if (data.data.path) {
      return data.data.path;
    }
  }
  // Fallback for old format
  if (data.url) {
    return data.url;
  }
  if (data.publicUrl) {
    return data.publicUrl;
  }
  if (data.path) {
    return data.path;
  }
  throw new ApiError('Invalid response format from upload API', 'INVALID_RESPONSE', 500);
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) handleError(error);
}

// Payment Intent API
// NOTE: This function now uses API route which handles multi-vendor orders
// For creating payment intent for existing order, use createPaymentIntentForOrder()
export async function createPaymentIntent(
  items: Array<{ listing_id: string; quantity: number }>,
  shippingInfo: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }
): Promise<{ order_id: string; client_secret: string; stripe_payment_intent: string } | { orders: Array<{ order_id: string; client_secret: string; stripe_payment_intent: string; vendor_id: string; amount: number }>; is_multi_vendor: boolean; total_amount: number }> {
  try {
    const response = await fetch(resolveApiUrl('/api/orders/create-multi-vendor'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        items,
        shipping_info: shippingInfo,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create order' }));
      throw new ApiError(
        errorData.error || "Failed to create order",
        errorData.type || "ORDER_CREATION_FAILED",
        response.status
      );
    }

    const result = await response.json();
    const payload = result.data ?? result;
    const orders = payload?.orders ?? [];

    if (!orders.length) {
      throw new ApiError(
        payload?.error || result.error || 'No orders were created',
        payload?.code || result.code || 'ORDER_CREATION_FAILED',
        response.status
      );
    }

    if (orders.length === 1) {
      const order = orders[0];
      return {
        order_id: order.order_id,
        client_secret: order.client_secret,
        stripe_payment_intent: order.stripe_payment_intent,
      };
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to create payment intent", "PAYMENT_ERROR", 500);
  }
}

/**
 * Create payment intent for an existing order
 * CLERK MIGRATION: Uses API route with Clerk authentication
 */
export async function createPaymentIntentForOrder(
  orderId: string,
  amount: number,
  currency: string = "usd",
  customerId?: string
): Promise<{ clientSecret: string; stripe_payment_intent: string }> {
  const response = await fetch(resolveApiUrl("/api/payment/create-intent"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies for Clerk auth
    body: JSON.stringify({
      orderId,
      amount,
      currency,
      customerId,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new ApiError(
      result.error || "Failed to create payment intent",
      result.code || "PAYMENT_ERROR",
      response.status
    );
  }

  // Backend returns: { success: true, data: { clientSecret, stripe_payment_intent } }
  if (result.data) {
    return {
      clientSecret: result.data.clientSecret || result.data.client_secret,
      stripe_payment_intent: result.data.stripe_payment_intent || result.data.stripePaymentIntent,
    };
  }
  if (result.clientSecret || result.client_secret) {
    return {
      clientSecret: result.clientSecret || result.client_secret,
      stripe_payment_intent: result.stripe_payment_intent || result.stripePaymentIntent,
    };
  }
  throw new ApiError("Invalid response format from payment API", "INVALID_RESPONSE", 500);
}

// Vendor Profiles API
export async function getVendorProfile(vendorId: string): Promise<VendorProfile> {
  const profileId = vendorId;

  const { data, error } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error) handleError(error);
  if (!data) {
    // Return a minimal vendor profile if it doesn't exist (for onboarding)
    return {
      id: profileId,
      business_name: null,
      business_email: null,
      business_phone: null,
      business_address: {},
      documents: [],
      payout_balance: 0,
      stripe_onboard_status: 'not_started',
      subscription_tier: 'free',
      subscription_status: 'active',
      listing_limit: 5,
      transaction_fee_percent: 2.00,
    } as VendorProfile;
  }
  return data as VendorProfile;
}

export async function applyVendor(
  applicationData: VendorApplication,
  documentFiles?: File[]
): Promise<VendorProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Upload documents if provided
  // Note: For private bucket, we store the path and use signed URLs when needed
  const documents: Array<{ type: string; url: string; filename: string; uploaded_at: string; path?: string }> = [];
  
  if (documentFiles && documentFiles.length > 0) {
    for (const file of documentFiles) {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("vendor-docs")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new ApiError(`Failed to upload ${file.name}: ${uploadError.message}`, "UPLOAD_ERROR", 400);
      }

      // For private bucket, we store the path and will use signed URLs when serving
      // Store path in metadata for admin access via Edge Function
      documents.push({
        type: file.type.includes("image") ? "id" : "business_license", // Simple type detection
        url: uploadData.path, // Store path, not public URL (bucket is private)
        filename: file.name,
        uploaded_at: new Date().toISOString(),
        path: uploadData.path, // Store for reference
      });
    }
  }

  // Create vendor profile
  const vendorProfileData: VendorProfileCreate = {
    business_name: applicationData.business_name,
    business_email: applicationData.business_email,
    business_phone: applicationData.business_phone || null,
    business_address: applicationData.business_address || {},
    documents: documents,
    payout_balance: 0,
    stripe_onboard_status: "not_started",
  };

  const { data, error } = await supabase
    .from("vendor_profiles")
    .insert({ ...vendorProfileData, id: user.id })
    .select()
    .single();

  if (error) handleError(error);

  // Update profile to mark as vendor (but not verified yet)
  await supabase
    .from("profiles")
    .update({ is_vendor: true, vendor_verified: false })
    .eq("id", user.id);

  return data as VendorProfile;
}

export async function updateVendorProfile(
  vendorId: string,
  updates: VendorProfileUpdate
): Promise<VendorProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== vendorId) {
    throw new ApiError("Unauthorized", "UNAUTHORIZED", 403);
  }

  const { data, error } = await supabase
    .from("vendor_profiles")
    .update(updates)
    .eq("id", vendorId)
    .select()
    .single();

  if (error) handleError(error);
  return data as VendorProfile;
}

export interface VendorDashboardStats {
  total_listings: number;
  active_listings: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  payout_balance: number;
  total_bookings: number;
  pending_bookings: number;
}

export async function getVendorDashboard(vendorId: string): Promise<VendorDashboardStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);
  // Only owner can view dashboard stats
  if (user.id !== vendorId) {
    throw new ApiError("Unauthorized", "UNAUTHORIZED", 403);
  }

  // Get vendor profile for payout balance
  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("payout_balance")
    .eq("id", vendorId)
    .single();

  // Get listings count
  const { count: totalListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId);

  const { count: activeListings } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId)
    .eq("active", true);

  // Get orders count
  const { count: totalOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId);

  const { count: pendingOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId)
    .in("status", ["pending", "paid"]);

  // Get total revenue (sum of completed orders)
  const { data: revenueData } = await supabase
    .from("orders")
    .select("total")
    .eq("vendor", vendorId)
    .in("status", ["paid", "completed"]);

  const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.total || 0), 0) || 0;

  // Get bookings count
  const { count: totalBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId);

  const { count: pendingBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("vendor", vendorId)
    .eq("status", "pending");

  return {
    total_listings: totalListings || 0,
    active_listings: activeListings || 0,
    total_orders: totalOrders || 0,
    pending_orders: pendingOrders || 0,
    total_revenue: totalRevenue,
    total_sales: totalRevenue,
    payout_balance: Number(vendorProfile?.payout_balance || 0),
    total_bookings: totalBookings || 0,
    pending_bookings: pendingBookings || 0,
  };
}

export async function startStripeConnectOnboard(): Promise<{ onboarding_url: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
    body: {
      vendor_id: user.id,
    },
  });

  if (error) handleError(error);
  if (data.error) throw new ApiError(data.error, "STRIPE_ERROR", 400);
  return data;
}

/**
 * Update store profile settings (banner, description, policies, hours, etc.)
 * Updates the profile table with store-specific fields
 */
export async function updateStoreProfile(
  vendorId: string,
  updates: {
    store_name?: string;
    store_description?: string;
    store_banner_url?: string | null;
    store_policies?: Record<string, any> | null;
    store_hours?: Record<string, any> | null;
    store_location?: string | null;
    store_social_links?: Record<string, string> | null;
  }
): Promise<Profile> {
  try {
    const response = await fetch(resolveApiUrl('/api/profile/update'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update store profile' }));
      throw new ApiError(
        errorData.error || "Failed to update store profile",
        errorData.type || "STORE_UPDATE_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return parseProfileFromApiResponse(result);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to update store profile", "STORE_UPDATE_FAILED", 500);
  }
}

/**
 * Get store reviews for a vendor
 */
export async function getStoreReviews(vendorId: string, limit: number = 20): Promise<any[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Fallback: if foreign key doesn't exist, query without the relation
    if (error.message?.includes('foreign key') || error.message?.includes('reviews_reviewer_id_fkey')) {
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (reviewsError) handleError(reviewsError);
      
      // Manually fetch reviewer profiles
      if (reviewsData && reviewsData.length > 0) {
        const reviewerIds = reviewsData
          .map(r => r.reviewer_id)
          .filter(Boolean);
        
        if (reviewerIds.length > 0) {
          const { data: reviewers } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", reviewerIds);
          
          const reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
          
          return reviewsData.map(review => ({
            ...review,
            reviewer: reviewersMap.get(review.reviewer_id) || null,
          }));
        }
      }
      
      return reviewsData || [];
    }
    handleError(error);
  }
  return (data || []) as any[];
}

/**
 * Create a store review
 */
export async function createStoreReview(
  vendorId: string,
  review: {
    rating: number;
    comment?: string;
    order_id?: string;
  }
): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Get profile UUID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    throw new ApiError("Profile not found", "PROFILE_NOT_FOUND", 404);
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      vendor_id: vendorId,
      reviewer_id: profile.id,
      rating: review.rating,
      comment: review.comment || null,
      order_id: review.order_id || null,
    })
    .select(`
      *,
      reviewer:profiles!reviews_reviewer_id_fkey(id, username, display_name, avatar_url)
    `)
    .single();

  if (error) {
    // Fallback: if foreign key doesn't exist, insert without relation and fetch reviewer separately
    if (error.message?.includes('foreign key') || error.message?.includes('reviews_reviewer_id_fkey')) {
      const { data: reviewData, error: insertError } = await supabase
        .from("reviews")
        .insert({
          vendor_id: vendorId,
          reviewer_id: profile.id,
          rating: review.rating,
          comment: review.comment || null,
          order_id: review.order_id || null,
        })
        .select("*")
        .single();
      
      if (insertError) handleError(insertError);
      
      // Fetch reviewer profile separately
      const { data: reviewerProfile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", profile.id)
        .single();
      
      return {
        ...reviewData,
        reviewer: reviewerProfile || null,
      };
    }
    handleError(error);
  }
  return data;
}

/**
 * Get vendor payout history
 * Returns list of payouts from Stripe Connect
 */
export async function getVendorPayouts(vendorId: string, limit: number = 20): Promise<any[]> {
  try {
    const response = await fetch(resolveApiUrl(`/api/vendor/payouts?vendorId=${vendorId}&limit=${limit}`), {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError('Failed to fetch payouts', 'PAYOUT_FETCH_ERROR', response.status);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to get vendor payouts", "PAYOUT_ERROR", 500);
  }
}

/**
 * Get vendor balance and earnings
 * Returns current balance, pending payouts, and available balance
 */
export async function getVendorBalance(vendorId: string): Promise<{
  current_balance: number;
  pending_balance: number;
  available_balance: number;
  lifetime_earnings: number;
}> {
  try {
    const response = await fetch(resolveApiUrl(`/api/vendor/balance?vendorId=${vendorId}`), {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError('Failed to fetch balance', 'BALANCE_FETCH_ERROR', response.status);
    }

    const result = await response.json();
    return result.data || {
      current_balance: 0,
      pending_balance: 0,
      available_balance: 0,
      lifetime_earnings: 0,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to get vendor balance", "BALANCE_ERROR", 500);
  }
}

/**
 * Create a refund for an order (vendor-initiated)
 * Allows vendors to issue full or partial refunds
 */
export async function createVendorRefund(
  orderId: string,
  amount?: number,
  reason?: string
): Promise<any> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/refund'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        order_id: orderId,
        amount,
        reason,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create refund' }));
      throw new ApiError(
        errorData.error || "Failed to create refund",
        errorData.type || "REFUND_ERROR",
        response.status
      );
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    handleError(error);
    throw new ApiError("Failed to create refund", "REFUND_ERROR", 500);
  }
}

// News API
export async function getNews(page: number = 0, pageSize: number = 20): Promise<News[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("is_published", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as News[];
}

export async function getNewsItem(newsId: string): Promise<News> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("id", newsId)
    .eq("is_published", true)
    .single();

  if (error) {
    // If news item not found, throw a more specific error
    if (error.code === "PGRST116") {
      throw new ApiError("News article not found", "NOT_FOUND", 404);
    }
    handleError(error);
  }
  
  if (!data) {
    throw new ApiError("News article not found", "NOT_FOUND", 404);
  }
  
  // Increment view count (don't fail if RPC doesn't exist)
  try {
    await supabase.rpc("increment_news_view_count", { news_id: newsId });
  } catch {
    // RPC might not exist, ignore
  }
  
  return data as News;
}

export async function createNews(news: NewsCreate): Promise<News> {
  try {
    const response = await fetch(resolveApiUrl("/api/admin/news"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(news),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to create news article" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to create news article",
        errorData.code || "NEWS_CREATE_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return (result.data?.news || result.news || result.data) as News;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function updateNews(newsId: string, updates: Partial<NewsCreate>): Promise<News> {
  try {
    const response = await fetch(resolveApiUrl(`/api/admin/news/${newsId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to update news article" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to update news article",
        errorData.code || "NEWS_UPDATE_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return (result.data?.news || result.news || result.data) as News;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function deleteNews(newsId: string): Promise<void> {
  try {
    const response = await fetch(resolveApiUrl(`/api/admin/news/${newsId}`), {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to delete news article" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to delete news article",
        errorData.code || "NEWS_DELETE_FAILED",
        response.status
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

// Groups API
export async function getGroups(page: number = 0, pageSize: number = 20): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Group[];
}

export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (error) handleError(error);
  return data as Group;
}

export async function createGroup(group: GroupCreate): Promise<Group> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data, error } = await supabase
    .from("groups")
    .insert({ ...group, owner: user.id })
    .select()
    .single();

  if (error) handleError(error);
  
  // Add creator as admin member
  await supabase
    .from("group_members")
    .insert({ group_id: data.id, user_id: user.id, role: "admin" });

  return data as Group;
}

export async function updateGroup(groupId: string, updates: GroupUpdate): Promise<Group> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Check if user is owner or admin
  const { data: group } = await supabase
    .from("groups")
    .select("owner")
    .eq("id", groupId)
    .single();

  if (!group || (group.owner !== user.id)) {
    throw new ApiError("Unauthorized", "UNAUTHORIZED", 403);
  }

  const { data, error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single();

  if (error) handleError(error);
  return data as Group;
}

export async function getGroupMembers(groupId: string): Promise<(GroupMember & { profile?: Profile })[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (error) handleError(error);
  return (data || []) as (GroupMember & { profile?: Profile })[];
}

export async function joinGroup(groupId: string): Promise<GroupMember> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data, error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: user.id, role: "member" })
    .select()
    .single();

  if (error) handleError(error);
  return data as GroupMember;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) handleError(error);
}

export async function getUserGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select(`
      group:groups(*)
    `)
    .eq("user_id", userId);

  if (error) handleError(error);
  return (data || []).map((item: any) => item.group) as Group[];
}

export async function getGroupPosts(groupId: string, page: number = 0, pageSize: number = 20): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Post[];
}

// Gamification API
/**
 * @deprecated Gamification updates are server-only (INTERNAL_API_SECRET).
 * Call from API routes/webhooks directly or use an internal server helper.
 */
export async function updateGamification(
  _userId: string,
  _action: 'purchase' | 'post_created' | 'comment_created' | 'like_given' | 'follow_user' | 'listing_created' | 'booking_created' | 'review_created',
  _metadata?: Record<string, unknown>
): Promise<{ pointsAdded: number; newTotalPoints: number }> {
  throw new ApiError(
    'Gamification updates are not available from the browser',
    'GAMIFICATION_SERVER_ONLY',
    403
  )
}

export async function getUserBadges(userId: string): Promise<(Badge & { awarded_at?: string })[]> {
  if (shouldUseMockApi()) {
    const badges = await mockApi.getUserBadges(userId);
    return badges.map(b => ({ ...b, awarded_at: new Date().toISOString() }));
  }

  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select(`
        awarded_at,
        badge:badges(*)
      `)
      .eq("user_id", userId)
      .order("awarded_at", { ascending: false });

    if (error) {
      if (shouldUseMockApi() || error.status === 401) {
        const badges = await mockApi.getUserBadges(userId);
        return badges.map(b => ({ ...b, awarded_at: new Date().toISOString() }));
      }
      handleError(error);
    }
    return (data || []).map((item: { badge: Badge; awarded_at: string }) => ({ ...item.badge, awarded_at: item.awarded_at })) as (Badge & { awarded_at?: string })[];
  } catch (error: unknown) {
    const errorStatus = error && typeof error === 'object' && 'status' in error ? (error.status as number) : undefined
    if (shouldUseMockApi() || errorStatus === 401) {
      const badges = await mockApi.getUserBadges(userId);
      return badges.map(b => ({ ...b, awarded_at: new Date().toISOString() }));
    }
    throw error;
  }
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from("badges")
    .select("*")
    .order("name", { ascending: true });

  if (error) handleError(error);
  return (data || []) as Badge[];
}

export async function getLeaderboard(period: "daily" | "weekly" | "monthly" | "all_time" = "all_time", limit: number = 100): Promise<(Leaderboard & { profile?: Profile })[]> {
  if (shouldUseMockApi()) {
    const leaderboard = await mockApi.getLeaderboard(period, limit);
    return leaderboard.map((item, index) => ({
      ...item,
      profile: undefined,
      rank: index + 1,
    }));
  }

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq("period", period)
      .order("rank", { ascending: true })
      .limit(limit);

    if (error) {
      // Leaderboard table might not exist (404), return empty array in test mode
      if (shouldUseMockApi() || error.status === 401 || error.status === 404) {
        const leaderboard = await mockApi.getLeaderboard(period, limit);
        return leaderboard.map((item, index) => ({
          ...item,
          profile: undefined,
          rank: index + 1,
        }));
      }
      handleError(error);
    }
    return (data || []) as (Leaderboard & { profile?: Profile })[];
  } catch (error: unknown) {
    const errorStatus = error && typeof error === 'object' && 'status' in error ? (error.status as number) : undefined
    if (shouldUseMockApi() || errorStatus === 401 || errorStatus === 404) {
      const leaderboard = await mockApi.getLeaderboard(period, limit);
      return leaderboard.map((item, index) => ({
        ...item,
        profile: undefined,
        rank: index + 1,
      }));
    }
    throw error;
  }
}

export async function getGroupLeaderboard(groupId: string, limit: number = 50): Promise<Array<{ user_id: string; points: number; profile?: Profile }>> {
  // Get points from user_points where metadata contains group_id
  const { data, error } = await supabase
    .from("user_points")
    .select(`
      user_id,
      points,
      profile:profiles(*)
    `)
    .contains("metadata", { group_id: groupId })
    .order("points", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  
  // Aggregate points by user
  const userPointsMap = new Map<string, { user_id: string; points: number; profile?: Profile }>();
  
  (data || []).forEach((item: any) => {
    const userId = item.user_id;
    if (userPointsMap.has(userId)) {
      userPointsMap.get(userId)!.points += item.points;
    } else {
      userPointsMap.set(userId, {
        user_id: userId,
        points: item.points,
        profile: item.profile,
      });
    }
  });

  return Array.from(userPointsMap.values()).sort((a, b) => b.points - a.points);
}

export async function getUserPointsHistory(userId: string, limit: number = 50): Promise<Array<{ points: number; reason: string; metadata: any; awarded_at: string }>> {
  const { data, error } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false })
    .limit(limit);

  if (error) handleError(error);
  return (data || []) as Array<{ points: number; reason: string; metadata: any; awarded_at: string }>;
}

// Coupons & Promotions API
export interface Coupon {
  id: string;
  vendor_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  expires_at?: string;
  usage_limit?: number;
  usage_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponCreate {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_purchase?: number;
  max_discount?: number;
  expires_at?: string;
  usage_limit?: number;
  active?: boolean;
}

export interface CouponUpdate {
  code?: string;
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  min_purchase?: number;
  max_discount?: number;
  expires_at?: string;
  usage_limit?: number;
  active?: boolean;
}

export async function getVendorCoupons(vendorId: string): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) handleError(error);
  return (data || []) as Coupon[];
}

export async function getCoupon(couponId: string): Promise<Coupon> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("id", couponId)
    .single();

  if (error) handleError(error);
  return data as Coupon;
}

export async function getCouponByCode(code: string, vendorId?: string): Promise<Coupon | null> {
  let query = supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("active", true);

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;
  return data as Coupon;
}

export async function createCoupon(coupon: CouponCreate): Promise<Coupon> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      ...coupon,
      vendor_id: user.id,
      code: coupon.code.toUpperCase(),
    })
    .select()
    .single();

  if (error) handleError(error);
  return data as Coupon;
}

export async function updateCoupon(couponId: string, updates: CouponUpdate): Promise<Coupon> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Verify ownership
  const { data: coupon } = await supabase
    .from("coupons")
    .select("vendor_id")
    .eq("id", couponId)
    .single();

  if (!coupon || coupon.vendor_id !== user.id) {
    throw new ApiError("Unauthorized", "UNAUTHORIZED", 403);
  }

  const { data, error } = await supabase
    .from("coupons")
    .update(updates)
    .eq("id", couponId)
    .select()
    .single();

  if (error) handleError(error);
  return data as Coupon;
}

export async function deleteCoupon(couponId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated", "UNAUTHENTICATED", 401);

  // Verify ownership
  const { data: coupon } = await supabase
    .from("coupons")
    .select("vendor_id")
    .eq("id", couponId)
    .single();

  if (!coupon || coupon.vendor_id !== user.id) {
    throw new ApiError("Unauthorized", "UNAUTHORIZED", 403);
  }

  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", couponId);

  if (error) handleError(error);
}

export async function validateCoupon(code: string, totalAmount: number, vendorId?: string): Promise<{ valid: boolean; discount: number; coupon?: Coupon; error?: string }> {
  const coupon = await getCouponByCode(code, vendorId);

  if (!coupon) {
    return { valid: false, discount: 0, error: "Invalid coupon code" };
  }

  // Check expiration
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { valid: false, discount: 0, error: "Coupon has expired" };
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, discount: 0, error: "Coupon usage limit reached" };
  }

  // Check minimum purchase
  if (coupon.min_purchase && totalAmount < coupon.min_purchase) {
    return { valid: false, discount: 0, error: `Minimum purchase of $${coupon.min_purchase} required` };
  }

  // Calculate discount
  let discount = 0;
  if (coupon.discount_type === "percentage") {
    discount = (totalAmount * coupon.discount_value) / 100;
    if (coupon.max_discount) {
      discount = Math.min(discount, coupon.max_discount);
    }
  } else {
    discount = coupon.discount_value;
  }

  return { valid: true, discount, coupon };
}

// Personalized Feed API
export async function getPersonalizedFeed(userId: string, page: number = 0, pageSize: number = 20): Promise<Post[]> {
  if (shouldUseMockApi()) {
    return await mockApi.getPersonalizedFeed(userId, page, pageSize);
  }

  try {
    // Get users the current user follows
    const { data: following } = await supabase
      .from("follows")
      .select("following")
      .eq("follower", userId);

    const followingIds = following?.map((f) => f.following) || [];

    // Get posts from followed users + public posts
    let query = supabase
      .from("posts")
      .select("*")
      .in("visibility", ["public", "followers"]);

    if (followingIds.length > 0) {
      query = query.or(`author.in.(${followingIds.join(",")}),visibility.eq.public`);
    } else {
      query = query.eq("visibility", "public");
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.warn('Personalized feed query failed, falling back to public feed', error);
      return getFeedPosts(page, pageSize);
    }

    const posts = (data || []) as Post[];
    if (posts.length === 0) {
      return getFeedPosts(page, pageSize);
    }
    return posts;
  } catch (error: unknown) {
    logger.warn('Personalized feed error, falling back to public feed', error);
    try {
      return await getFeedPosts(page, pageSize);
    } catch {
      const errorStatus =
        error && typeof error === 'object' && 'status' in error
          ? (error.status as number)
          : undefined;
      if (shouldUseMockApi() || errorStatus === 401) {
        return await mockApi.getPersonalizedFeed(userId, page, pageSize);
      }
      throw error;
    }
  }
}

export async function getRecommendedListings(userId: string, limit: number = 6): Promise<Listing[]> {
  if (shouldUseMockApi()) {
    return await mockApi.getRecommendedListings(userId, limit);
  }

  try {
    // Get user's past orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("buyer", userId)
      .limit(10);

  const orderIds = orders?.map((o) => o.id) || [];
  
  // Get categories from past orders
  const categories = new Set<string>();
  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        listing:listings(category)
      `)
      .in("order_id", orderIds);

    orderItems?.forEach((item: { listing?: { category?: string } }) => {
      if (item.listing?.category) {
        categories.add(item.listing.category);
      }
    });
  }

  // Get listings from similar categories or trending
  let query = supabase
    .from("listings")
    .select("*")
    .eq("active", true);

  if (categories.size > 0) {
    query = query.in("category", Array.from(categories));
  }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (shouldUseMockApi() || error.status === 401) {
        return await mockApi.getRecommendedListings(userId, limit);
      }
      handleError(error);
    }
    return (data || []) as Listing[];
  } catch (error: unknown) {
    const errorStatus = error && typeof error === 'object' && 'status' in error ? (error.status as number) : undefined
    if (shouldUseMockApi() || errorStatus === 401) {
      return await mockApi.getRecommendedListings(userId, limit);
    }
    throw error;
  }
}

export async function getRecommendedVendors(userId: string, limit: number = 6): Promise<Profile[]> {
  if (shouldUseMockApi()) {
    return await mockApi.getRecommendedVendors(userId, limit);
  }

  try {
    // Get user's past orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("buyer", userId)
      .limit(10);

  const orderIds = orders?.map((o) => o.id) || [];
  
  // Get vendors from past orders
  const vendorIds = new Set<string>();
  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        listing:listings(vendor)
      `)
      .in("order_id", orderIds);

    orderItems?.forEach((item: { listing?: { vendor?: string } }) => {
      if (item.listing?.vendor) {
        vendorIds.add(item.listing.vendor);
      }
    });
  }

    // Get verified vendors, prioritizing those user has purchased from
    if (vendorIds.size > 0) {
      const { data: recommended } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_vendor", true)
        .eq("vendor_verified", true)
        .in("id", Array.from(vendorIds))
        .limit(limit);

      if (recommended && recommended.length > 0) {
        return recommended as Profile[];
      }
    }

    // Fallback to top vendors
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_vendor", true)
      .eq("vendor_verified", true)
      .order("points", { ascending: false })
      .limit(limit);

    if (error) {
      if (shouldUseMockApi() || error.status === 401) {
        return await mockApi.getRecommendedVendors(userId, limit);
      }
      handleError(error);
    }
    return (data || []) as Profile[];
  } catch (error: unknown) {
    const errorStatus = error && typeof error === 'object' && 'status' in error ? (error.status as number) : undefined
    if (shouldUseMockApi() || errorStatus === 401) {
      return await mockApi.getRecommendedVendors(userId, limit);
    }
    throw error;
  }
}

// Admin API Functions
export async function getAllUsers(page: number = 0, pageSize: number = 50): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Profile[];
}

export async function getAllVendors(page: number = 0, pageSize: number = 50): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_vendor", true)
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) handleError(error);
  return (data || []) as Profile[];
}

export async function updateUserProfile(userId: string, updates: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) handleError(error);
  return data as Profile;
}

export async function deleteUser(userId: string): Promise<void> {
  // Delete user from auth (requires admin API)
  // For now, we'll just delete the profile
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (error) handleError(error);
}

// Badge Management API
export interface BadgeCreate {
  key: string;
  name: string;
  description?: string;
  icon?: string;
}

export type BadgeUpdate = Partial<Omit<BadgeCreate, "key">>;

export async function createBadge(badge: BadgeCreate): Promise<Badge> {
  const { data, error } = await supabase
    .from("badges")
    .insert(badge)
    .select()
    .single();

  if (error) handleError(error);
  return data as Badge;
}

export async function updateBadge(badgeId: string, updates: BadgeUpdate): Promise<Badge> {
  const { data, error } = await supabase
    .from("badges")
    .update(updates)
    .eq("id", badgeId)
    .select()
    .single();

  if (error) handleError(error);
  return data as Badge;
}

export async function deleteBadge(badgeId: string): Promise<void> {
  const { error } = await supabase
    .from("badges")
    .delete()
    .eq("id", badgeId);

  if (error) handleError(error);
}

// ============================================
// Stories API
// ============================================

export interface StoryWithUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  stories: Array<{
    id: string;
    media_url: string;
    media_type: 'image' | 'video';
    caption: string | null;
    view_count: number;
    expires_at: string;
    created_at: string;
    is_viewed: boolean;
    reply_count: number;
  }>;
  has_unviewed: boolean;
}

/**
 * Get active stories for the current user's feed
 */
export async function getStories(): Promise<StoryWithUser[]> {
  try {
    const response = await fetch(resolveApiUrl('/api/stories'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch stories' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to fetch stories',
        errorData.code || 'STORIES_FETCH_FAILED',
        response.status
      );
    }

    const result = await response.json();
    // API returns { success: true, data: { stories, total } }
    if (result.success && result.data) {
      return result.data.stories || [];
    }
    // Fallback for different response format
    if (result.data?.stories) {
      return result.data.stories || [];
    }
    if (result.stories) {
      return result.stories || [];
    }
    return [];
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Create a new story
 */
export async function createStory(story: StoryCreate): Promise<Story> {
  try {
    console.log('Creating story:', story);
    
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/api/stories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(story),
      });
    } catch (fetchError) {
      console.error('Story fetch error (network issue):', fetchError);
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        throw new ApiError(
          'Network error. Please check your internet connection and make sure the server is running.',
          'NETWORK_ERROR',
          0
        );
      }
      throw fetchError;
    }

    console.log('Story response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create story' }));
      console.error('Story creation error:', errorData);
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to create story',
        errorData.code || 'STORY_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    console.log('Story creation result:', result);
    // API returns { success: true, data: { story } }
    if (result.success && result.data) {
      return result.data.story as Story;
    }
    // Fallback for different response format
    if (result.data?.story) {
      return result.data.story as Story;
    }
    if (result.story) {
      return result.story as Story;
    }
    throw new ApiError('Invalid response format from story API', 'INVALID_RESPONSE', 500);
  } catch (error) {
    console.error('Story creation exception:', error);
    if (error instanceof ApiError) throw error;
    
    // Handle network errors specifically
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Network error. Please check your internet connection and make sure the server is running.',
        'NETWORK_ERROR',
        0
      );
    }
    
    handleError(error);
  }
}

/**
 * Record a view for a story
 */
export async function recordStoryView(view: StoryViewCreate): Promise<{ viewed: boolean; already_viewed?: boolean }> {
  try {
    const response = await fetch(resolveApiUrl('/api/stories/views'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(view),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to record view' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to record view',
        errorData.code || 'STORY_VIEW_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data || { viewed: true };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Send a reply to a story
 */
export async function sendStoryReply(reply: StoryReplyCreate): Promise<{ id: string; story_id: string; sender_id: string; message: string; created_at: string }> {
  try {
    const response = await fetch(resolveApiUrl('/api/stories/replies'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reply),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to send reply' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to send reply',
        errorData.code || 'STORY_REPLY_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data?.reply as { id: string; story_id: string; sender_id: string; message: string; created_at: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Toggle like on a story
 */
export async function toggleStoryLike(storyId: string): Promise<{ liked: boolean; like_count: number }> {
  try {
    const response = await fetch(resolveApiUrl('/api/stories/likes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ story_id: storyId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to like story' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to like story',
        errorData.code || 'STORY_LIKE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as { liked: boolean; like_count: number };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Get like status and count for a story
 */
export async function getStoryLikeStatus(storyId: string): Promise<{ is_liked: boolean; like_count: number }> {
  try {
    const response = await fetch(resolveApiUrl(`/api/stories/likes?story_id=${storyId}`), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to get like status' }));
      throw new ApiError(
        errorData.error || errorData.message || 'Failed to get like status',
        errorData.code || 'STORY_LIKE_STATUS_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as { is_liked: boolean; like_count: number };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export async function getAllNews(page: number = 0, pageSize: number = 50): Promise<News[]> {
  try {
    const response = await fetch(resolveApiUrl(`/api/admin/news?includeUnpublished=true&page=${page}&pageSize=${pageSize}`), {
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 403) {
        return getNews(page, pageSize);
      }
      const errorData = await response.json().catch(() => ({ error: "Failed to fetch news" }));
      throw new ApiError(
        errorData.error || errorData.message || "Failed to fetch news",
        errorData.code || "NEWS_FETCH_FAILED",
        response.status
      );
    }

    const result = await response.json();
    return (result.data?.news || result.news || result.data || []) as News[];
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

// Admin: Create public post
export async function createPublicPost(post: PostCreate): Promise<Post> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError("Not authenticated. Please sign in to create a post.", "UNAUTHENTICATED", 401);

  // Verify user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new ApiError("Only admins can create public posts via this function.", "FORBIDDEN", 403);
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...post, author: user.id, visibility: post.visibility || "public" })
    .select()
    .single();

  if (error) {
    if (error.code === "42501" || error.message?.includes("permission denied")) {
      throw new ApiError(
        "Permission denied. Please ensure you are an admin and your email is confirmed.",
        "PERMISSION_DENIED",
        403
      );
    }
    handleError(error);
  }
  
  return data as Post;
}

// ============================================
// Vendor Subscriptions API
// ============================================

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  tier: 'free' | 'basic' | 'pro' | 'premium';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Get vendor's current subscription
 */
export async function getVendorSubscription(): Promise<VendorSubscription | null> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions'), {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch subscription' }));
      if (response.status === 404) {
        return null; // No subscription found
      }
      throw new ApiError(
        errorData.error || 'Failed to fetch subscription',
        errorData.code || 'SUBSCRIPTION_FETCH_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as VendorSubscription;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Create or update vendor subscription
 */
export async function createVendorSubscription(tier: 'free' | 'basic' | 'pro' | 'premium'): Promise<VendorSubscription> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tier }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create subscription' }));
      throw new ApiError(
        errorData.error || 'Failed to create subscription',
        errorData.code || 'SUBSCRIPTION_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as VendorSubscription;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Update vendor subscription (cancel at period end, change tier, etc.)
 */
export async function updateVendorSubscription(updates: {
  tier?: 'free' | 'basic' | 'pro' | 'premium';
  cancel_at_period_end?: boolean;
}): Promise<VendorSubscription> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update subscription' }));
      throw new ApiError(
        errorData.error || 'Failed to update subscription',
        errorData.code || 'SUBSCRIPTION_UPDATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as VendorSubscription;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Cancel vendor subscription immediately
 */
export async function cancelVendorSubscription(): Promise<VendorSubscription> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions'), {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to cancel subscription' }));
      throw new ApiError(
        errorData.error || 'Failed to cancel subscription',
        errorData.code || 'SUBSCRIPTION_CANCEL_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as VendorSubscription;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Create Stripe Checkout Session for subscription
 */
export async function createSubscriptionCheckout(tier: 'basic' | 'pro' | 'premium', successUrl?: string, cancelUrl?: string): Promise<{ url: string }> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tier,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create checkout session' }));
      throw new ApiError(
        errorData.error || 'Failed to create checkout session',
        errorData.code || 'CHECKOUT_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as { url: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Create Stripe Customer Portal session
 */
export async function createCustomerPortalSession(): Promise<{ url: string }> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/subscriptions/portal'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create portal session' }));
      throw new ApiError(
        errorData.error || 'Failed to create portal session',
        errorData.code || 'PORTAL_CREATE_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as { url: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

// ============================================
// Stripe Connect API
// ============================================

export interface ConnectStatus {
  status: 'not_started' | 'pending' | 'active';
  details: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  account_id?: string;
}

/**
 * Start Stripe Connect onboarding
 */
export async function startConnectOnboarding(): Promise<{ url: string; accountId: string }> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/connect/onboard'), {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to start Connect onboarding' }));
      throw new ApiError(
        errorData.error || 'Failed to start Connect onboarding',
        errorData.code || 'CONNECT_ONBOARD_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as { url: string; accountId: string };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

/**
 * Get Stripe Connect account status
 */
export async function getConnectStatus(): Promise<ConnectStatus> {
  try {
    const response = await fetch(resolveApiUrl('/api/vendor/connect/status'), {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch Connect status' }));
      throw new ApiError(
        errorData.error || 'Failed to fetch Connect status',
        errorData.code || 'CONNECT_STATUS_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as ConnectStatus;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

// ============================================
// Shipping API (Shippo)
// ============================================

export interface ShippingRate {
  object_id: string;
  provider: string;
  servicelevel: string;
  amount: string;
  currency: string;
  estimated_days?: number;
  duration_terms?: string;
}

export interface ShippingRatesResponse {
  shipment_id: string;
  rates: ShippingRate[];
  address_from: any;
  address_to: any;
}

/**
 * Get shipping rates for an order
 */
export async function getShippingRates(params: {
  order_id: string;
  from_address: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  to_address: {
    name: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
    phone?: string;
    email?: string;
  };
  parcel: {
    length: string;
    width: string;
    height: string;
    distance_unit?: 'in' | 'cm';
    weight: string;
    mass_unit?: 'lb' | 'kg' | 'oz' | 'g';
  };
  carrier_accounts?: string[];
}): Promise<ShippingRatesResponse> {
  try {
    const response = await fetch(resolveApiUrl('/api/shipping/rates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get shipping rates' }));
      throw new ApiError(
        errorData.error || 'Failed to get shipping rates',
        errorData.code || 'SHIPPING_RATES_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as ShippingRatesResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export interface ShippingLabel {
  label_url: string;
  tracking_number: string;
  shippo_transaction_id: string;
}

/**
 * Purchase shipping label
 */
export async function purchaseShippingLabel(order_id: string, rate_id: string, metadata?: Record<string, any>): Promise<ShippingLabel> {
  try {
    const response = await fetch(resolveApiUrl('/api/shipping/labels'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        order_id,
        rate_id,
        metadata,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to purchase shipping label' }));
      throw new ApiError(
        errorData.error || 'Failed to purchase shipping label',
        errorData.code || 'SHIPPING_LABEL_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as ShippingLabel;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

export interface TrackingStatus {
  tracking_number: string;
  carrier: string;
  status: string;
  status_details?: string;
  location?: any;
  tracking_history?: Array<{
    status: string;
    status_details: string;
    status_date: string;
    location?: any;
  }>;
}

/**
 * Get tracking status for a shipment
 */
export async function getTrackingStatus(tracking_number: string, carrier?: string): Promise<TrackingStatus> {
  try {
    const params = new URLSearchParams({ tracking_number });
    if (carrier) params.append('carrier', carrier);

    const response = await fetch(resolveApiUrl(`/api/shipping/track?${params.toString()}`), {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to get tracking status' }));
      throw new ApiError(
        errorData.error || 'Failed to get tracking status',
        errorData.code || 'TRACKING_STATUS_FAILED',
        response.status
      );
    }

    const result = await response.json();
    return result.data as TrackingStatus;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleError(error);
  }
}

