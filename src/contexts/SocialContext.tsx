'use client'

// CLERK MIGRATION: Social features context with real-time updates
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { ensureProfileUuid } from '@/lib/user-id-helpers'
import type { Post, Comment, Like } from '@/lib/types'

interface SocialContextType {
  // Posts
  posts: Post[]
  loading: boolean
  createPost: (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updatePost: (postId: string, updates: Partial<Post>) => Promise<void>
  deletePost: (postId: string) => Promise<void>
  
  // Comments
  getComments: (postId: string) => Comment[]
  addComment: (postId: string, content: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
  
  // Likes
  isLiked: (targetType: 'post' | 'comment', targetId: string) => boolean
  toggleLike: (targetType: 'post' | 'comment', targetId: string) => Promise<void>
  getLikeCount: (targetType: 'post' | 'comment', targetId: string) => number
  
  // Shares/Reposts
  sharePost: (postId: string) => Promise<void>
  
  // Friendships
  followUser: (userId: string) => Promise<void>
  unfollowUser: (userId: string) => Promise<void>
  isFollowing: (userId: string) => boolean
  getFollowers: (userId: string) => Promise<string[]>
  getFollowing: (userId: string) => Promise<string[]>
}

const SocialContext = createContext<SocialContextType | undefined>(undefined)

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, profile, getProfileUuid } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<Like[]>([])
  const [follows, setFollows] = useState<{ follower_id: string; following_id: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Load initial data
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    loadInitialData()
    const cleanup = setupRealtimeSubscriptions()

    return () => {
      // Cleanup subscriptions
      if (cleanup) {
        cleanup()
      }
    }
  }, [user])

  const loadInitialData = async () => {
    try {
      // Load posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (postsData) setPosts(postsData)

      // Load comments
      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true })

      if (commentsData) setComments(commentsData)

      // Load likes - use profile UUID
      if (user && profile?.id) {
        const profileUuid = profile.id
        const { data: likesData } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', profileUuid)

        if (likesData) setLikes(likesData)

        // Load follows - use profile UUID
        const { data: followsData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', profileUuid)

        if (followsData) {
          setFollows(followsData.map(f => ({
            follower_id: f.follower_id,
            following_id: f.following_id,
          })))
        }
      }
    } catch (error) {
      console.error('Error loading social data:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = (): (() => void) | undefined => {
    if (!user) return undefined

    try {
      // Subscribe to posts (using private channel - Supabase best practice)
      const postsChannel = supabase
        .channel(`posts-changes-${Date.now()}`, {
          config: { private: true }, // Private channel for security
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'posts',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setPosts((prev) => [payload.new as Post, ...prev])
            } else if (payload.eventType === 'UPDATE') {
              setPosts((prev) =>
                prev.map((p) => (p.id === payload.new.id ? (payload.new as Post) : p))
              )
            } else if (payload.eventType === 'DELETE') {
              setPosts((prev) => prev.filter((p) => p.id !== payload.old.id))
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Posts channel subscribed')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Posts channel error')
          }
        })

      // Subscribe to comments (using private channel)
      const commentsChannel = supabase
        .channel(`comments-changes-${Date.now()}`, {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'comments',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setComments((prev) => [...prev, payload.new as Comment])
            } else if (payload.eventType === 'DELETE') {
              setComments((prev) => prev.filter((c) => c.id !== payload.old.id))
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Comments channel subscribed')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Comments channel error')
          }
        })

      // Subscribe to likes (using private channel)
      const likesChannel = supabase
        .channel(`likes-changes-${Date.now()}`, {
          config: { private: true },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'likes',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setLikes((prev) => [...prev, payload.new as Like])
            } else if (payload.eventType === 'DELETE') {
              setLikes((prev) => prev.filter((l) => l.id !== payload.old.id))
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Likes channel subscribed')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Likes channel error')
          }
        })

      // Return cleanup function
      return () => {
        try {
          postsChannel.unsubscribe()
          commentsChannel.unsubscribe()
          likesChannel.unsubscribe()
          // Remove channels from Supabase client
          supabase.removeChannel(postsChannel)
          supabase.removeChannel(commentsChannel)
          supabase.removeChannel(likesChannel)
        } catch (error) {
          console.error('Error cleaning up subscriptions:', error)
        }
      }
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error)
      return undefined
    }
  }

  const createPost = async (postData: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const { data, error } = await supabase
      .from('posts')
      .insert({
        ...postData,
        user_id: profileUuid, // Use profile UUID, not Clerk ID
      })
      .select()
      .single()

    if (error) throw error
    if (data) setPosts((prev) => [data, ...prev])
  }

  const updatePost = async (postId: string, updates: Partial<Post>) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const { error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .eq('user_id', profileUuid) // Use profile UUID, not Clerk ID

    if (error) throw error

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))
    )
  }

  const deletePost = async (postId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', profileUuid) // Use profile UUID, not Clerk ID

    if (error) throw error

    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const getComments = (postId: string): Comment[] => {
    return comments.filter((c) => c.post_id === postId)
  }

  const addComment = async (postId: string, content: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: profileUuid, // Use profile UUID, not Clerk ID
        content,
      })
      .select()
      .single()

    if (error) throw error
    if (data) setComments((prev) => [...prev, data])
  }

  const deleteComment = async (commentId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', profileUuid) // Use profile UUID, not Clerk ID

    if (error) throw error

    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  const isLiked = (targetType: 'post' | 'comment', targetId: string): boolean => {
    if (!user || !profile?.id) return false
    const profileUuid = profile.id
    return likes.some(
      (l) => l.target_type === targetType && l.target_id === targetId && l.user_id === profileUuid
    )
  }

  const toggleLike = async (targetType: 'post' | 'comment', targetId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    const existingLike = likes.find(
      (l) => l.target_type === targetType && l.target_id === targetId && l.user_id === profileUuid
    )

    if (existingLike) {
      // Unlike
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('id', existingLike.id)

      if (error) throw error
      setLikes((prev) => prev.filter((l) => l.id !== existingLike.id))
    } else {
      // Like
      const { data, error } = await supabase
        .from('likes')
        .insert({
          target_type: targetType,
          target_id: targetId,
          user_id: profileUuid, // Use profile UUID, not Clerk ID
        })
        .select()
        .single()

      if (error) throw error
      if (data) setLikes((prev) => [...prev, data])
    }
  }

  const getLikeCount = (targetType: 'post' | 'comment', targetId: string): number => {
    return likes.filter((l) => l.target_type === targetType && l.target_id === targetId).length
  }

  const sharePost = async (postId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id

    // Create a repost/share
    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: profileUuid, // Use profile UUID, not Clerk ID
        content: '', // Repost doesn't need content
        shared_post_id: postId,
        type: 'share',
      })

    if (error) throw error
  }

  const followUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id
    
    // userId parameter should already be a UUID (from another profile)
    // But ensure it's not a Clerk ID
    const followingUuid = await ensureProfileUuid(userId)
    
    if (profileUuid === followingUuid) throw new Error('Cannot follow yourself')

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: profileUuid, // Use profile UUID, not Clerk ID
        following_id: followingUuid, // Ensure following_id is also UUID
      })

    if (error) throw error

    setFollows((prev) => [...prev, { follower_id: profileUuid, following_id: followingUuid }])
  }

  const unfollowUser = async (userId: string) => {
    if (!user) throw new Error('Not authenticated')
    if (!profile?.id) throw new Error('Profile not found. Please complete onboarding.')

    const profileUuid = profile.id
    const followingUuid = await ensureProfileUuid(userId)

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', profileUuid) // Use profile UUID, not Clerk ID
      .eq('following_id', followingUuid) // Ensure following_id is also UUID

    if (error) throw error

    setFollows((prev) =>
      prev.filter((f) => !(f.follower_id === profileUuid && f.following_id === followingUuid))
    )
  }

  const isFollowing = (userId: string): boolean => {
    if (!user || !profile?.id) return false
    const profileUuid = profile.id
    // Note: userId parameter should be UUID, but we'll compare as-is
    // If it's a Clerk ID, this comparison will fail (which is correct)
    return follows.some((f) => f.follower_id === profileUuid && f.following_id === userId)
  }

  const getFollowers = async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)

    return data?.map((f) => f.follower_id) || []
  }

  const getFollowing = async (userId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    return data?.map((f) => f.following_id) || []
  }

  return (
    <SocialContext.Provider
      value={{
        posts,
        loading,
        createPost,
        updatePost,
        deletePost,
        getComments,
        addComment,
        deleteComment,
        isLiked,
        toggleLike,
        getLikeCount,
        sharePost,
        followUser,
        unfollowUser,
        isFollowing,
        getFollowers,
        getFollowing,
      }}
    >
      {children}
    </SocialContext.Provider>
  )
}

export function useSocial() {
  const context = useContext(SocialContext)
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider')
  }
  return context
}

