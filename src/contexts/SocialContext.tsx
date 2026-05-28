'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRealtimeSubscription } from '@/lib/realtime'
import { ensureProfileUuid } from '@/lib/user-id-helpers'
import type { Post, Comment, Like } from '@/lib/types'

interface SocialContextType {
  posts: Post[]
  loading: boolean
  createPost: (post: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updatePost: (postId: string, updates: Partial<Post>) => Promise<void>
  deletePost: (postId: string) => Promise<void>
  getComments: (postId: string) => Comment[]
  addComment: (postId: string, content: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
  isLiked: (targetType: 'post' | 'comment', targetId: string) => boolean
  toggleLike: (targetType: 'post' | 'comment', targetId: string) => Promise<void>
  getLikeCount: (targetType: 'post' | 'comment', targetId: string) => number
  sharePost: (postId: string) => Promise<void>
  followUser: (userId: string) => Promise<void>
  unfollowUser: (userId: string) => Promise<void>
  isFollowing: (userId: string) => boolean
  getFollowers: (userId: string) => Promise<string[]>
  getFollowing: (userId: string) => Promise<string[]>
}

const SocialContext = createContext<SocialContextType | undefined>(undefined)

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const userId = user?.id
  const profileId = profile?.id

  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState<Like[]>([])
  const [follows, setFollows] = useState<{ follower_id: string; following_id: string }[]>([])
  const [loading, setLoading] = useState(true)

  const loadInitialData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (postsData) setPosts(postsData)

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true })

      if (commentsData) setComments(commentsData)

      if (profileId) {
        const { data: likesData } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', profileId)

        if (likesData) setLikes(likesData)

        const { data: followsData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', profileId)

        if (followsData) {
          setFollows(
            followsData.map((f) => ({
              follower_id: f.follower_id,
              following_id: f.following_id,
            }))
          )
        }
      }
    } catch (error) {
      console.error('Error loading social data:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, profileId])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    void loadInitialData()
  }, [userId, profileId, loadInitialData])

  const onPostsRealtime = useCallback((payload: { eventType: string; new: Post; old: { id: string } }) => {
    if (payload.eventType === 'INSERT') {
      setPosts((prev) => [payload.new, ...prev])
    } else if (payload.eventType === 'UPDATE') {
      setPosts((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)))
    } else if (payload.eventType === 'DELETE') {
      setPosts((prev) => prev.filter((p) => p.id !== payload.old.id))
    }
  }, [])

  const onCommentsRealtime = useCallback(
    (payload: { eventType: string; new: Comment; old: { id: string } }) => {
      if (payload.eventType === 'INSERT') {
        setComments((prev) => [...prev, payload.new])
      } else if (payload.eventType === 'DELETE') {
        setComments((prev) => prev.filter((c) => c.id !== payload.old.id))
      }
    },
    []
  )

  const onLikesRealtime = useCallback(
    (payload: { eventType: string; new: Like; old: { id: string } }) => {
      if (payload.eventType === 'INSERT') {
        setLikes((prev) => [...prev, payload.new])
      } else if (payload.eventType === 'DELETE') {
        setLikes((prev) => prev.filter((l) => l.id !== payload.old.id))
      }
    },
    []
  )

  useRealtimeSubscription(supabase, {
    table: 'posts',
    event: '*',
    channelName: userId ? `social:posts:${userId}` : undefined,
    enabled: !!userId,
    callback: onPostsRealtime,
  })

  useRealtimeSubscription(supabase, {
    table: 'comments',
    event: '*',
    channelName: userId ? `social:comments:${userId}` : undefined,
    enabled: !!userId,
    callback: onCommentsRealtime,
  })

  useRealtimeSubscription(supabase, {
    table: 'likes',
    event: '*',
    channelName: userId ? `social:likes:${userId}` : undefined,
    enabled: !!userId,
    callback: onLikesRealtime,
  })

  const createPost = useCallback(
    async (postData: Omit<Post, 'id' | 'created_at' | 'updated_at'>) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { data, error } = await supabase
        .from('posts')
        .insert({
          ...postData,
          user_id: profileId,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setPosts((prev) => [data, ...prev])
    },
    [userId, profileId]
  )

  const updatePost = useCallback(
    async (postId: string, updates: Partial<Post>) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', profileId)

      if (error) throw error
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p)))
    },
    [userId, profileId]
  )

  const deletePost = useCallback(
    async (postId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', profileId)

      if (error) throw error
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    },
    [userId, profileId]
  )

  const getComments = useCallback(
    (postId: string): Comment[] => comments.filter((c) => c.post_id === postId),
    [comments]
  )

  const addComment = useCallback(
    async (postId: string, content: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: profileId,
          content,
        })
        .select()
        .single()

      if (error) throw error
      if (data) setComments((prev) => [...prev, data])
    },
    [userId, profileId]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', profileId)

      if (error) throw error
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    },
    [userId, profileId]
  )

  const isLiked = useCallback(
    (targetType: 'post' | 'comment', targetId: string): boolean => {
      if (!profileId) return false
      return likes.some(
        (l) =>
          l.target_type === targetType && l.target_id === targetId && l.user_id === profileId
      )
    },
    [likes, profileId]
  )

  const toggleLike = useCallback(
    async (targetType: 'post' | 'comment', targetId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const existingLike = likes.find(
        (l) =>
          l.target_type === targetType && l.target_id === targetId && l.user_id === profileId
      )

      if (existingLike) {
        const { error } = await supabase.from('likes').delete().eq('id', existingLike.id)
        if (error) throw error
        setLikes((prev) => prev.filter((l) => l.id !== existingLike.id))
      } else {
        const { data, error } = await supabase
          .from('likes')
          .insert({
            target_type: targetType,
            target_id: targetId,
            user_id: profileId,
          })
          .select()
          .single()

        if (error) throw error
        if (data) setLikes((prev) => [...prev, data])
      }
    },
    [userId, profileId, likes]
  )

  const getLikeCount = useCallback(
    (targetType: 'post' | 'comment', targetId: string): number =>
      likes.filter((l) => l.target_type === targetType && l.target_id === targetId).length,
    [likes]
  )

  const sharePost = useCallback(
    async (postId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const { error } = await supabase.from('posts').insert({
        user_id: profileId,
        content: '',
        shared_post_id: postId,
        type: 'share',
      })

      if (error) throw error
    },
    [userId, profileId]
  )

  const followUser = useCallback(
    async (targetUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const followingUuid = await ensureProfileUuid(targetUserId)
      if (profileId === followingUuid) throw new Error('Cannot follow yourself')

      const { error } = await supabase.from('follows').insert({
        follower_id: profileId,
        following_id: followingUuid,
      })

      if (error) throw error
      setFollows((prev) => [...prev, { follower_id: profileId, following_id: followingUuid }])
    },
    [userId, profileId]
  )

  const unfollowUser = useCallback(
    async (targetUserId: string) => {
      if (!userId) throw new Error('Not authenticated')
      if (!profileId) throw new Error('Profile not found. Please complete onboarding.')

      const followingUuid = await ensureProfileUuid(targetUserId)

      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', profileId)
        .eq('following_id', followingUuid)

      if (error) throw error
      setFollows((prev) =>
        prev.filter((f) => !(f.follower_id === profileId && f.following_id === followingUuid))
      )
    },
    [userId, profileId]
  )

  const isFollowing = useCallback(
    (targetUserId: string): boolean => {
      if (!profileId) return false
      return follows.some((f) => f.follower_id === profileId && f.following_id === targetUserId)
    },
    [follows, profileId]
  )

  const getFollowers = useCallback(async (targetUserId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', targetUserId)

    return data?.map((f) => f.follower_id) || []
  }, [])

  const getFollowing = useCallback(async (targetUserId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', targetUserId)

    return data?.map((f) => f.following_id) || []
  }, [])

  const value = useMemo(
    (): SocialContextType => ({
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
    }),
    [
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
    ]
  )

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocial() {
  const context = useContext(SocialContext)
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider')
  }
  return context
}
