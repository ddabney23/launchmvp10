'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getStories, type StoryWithUser } from '@/lib/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { logger } from '@/lib/logger'

interface StoriesCarouselProps {
  onCreateStory?: () => void
}

export function StoriesCarousel({ onCreateStory }: StoriesCarouselProps) {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: stories, isLoading, error } = useQuery<StoryWithUser[]>({
    queryKey: ['stories'],
    queryFn: getStories,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Real-time subscription for stories
  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    // Subscribe to new stories
    const storiesChannel = supabase
      .channel(`stories-realtime:${userId}`, {
        config: { private: true },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stories',
        },
        (payload) => {
          // Invalidate stories query to refetch
          queryClient.invalidateQueries({ queryKey: ['stories'] })
          logger.debug('New story created, refreshing stories list')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'stories',
        },
        (payload) => {
          // Story expired or deleted, refresh list
          queryClient.invalidateQueries({ queryKey: ['stories'] })
          logger.debug('Story deleted/expired, refreshing stories list')
        }
      )
      .subscribe((status, err) => {
        if (err) {
          logger.warn('Stories realtime subscription error (non-critical)', {
            status,
            error: err.message || err,
          })
          return
        }
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to stories realtime updates')
        }
      })

    // Subscribe to story views (to update view status)
    const viewsChannel = supabase
      .channel(`story-views-realtime:${userId}`, {
        config: { private: true },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views',
        },
        (payload) => {
          // Invalidate to update view status in carousel
          queryClient.invalidateQueries({ queryKey: ['stories'] })
        }
      )
      .subscribe((status, err) => {
        if (err) {
          logger.warn('Story views realtime subscription error (non-critical)', {
            status,
            error: err.message || err,
          })
        }
      })

    return () => {
      // Cleanup subscriptions
      supabase.removeChannel(storiesChannel)
      supabase.removeChannel(viewsChannel)
    }
  }, [user?.id, queryClient])

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-16 h-16 rounded-full" />
      </div>
    )
  }

  if (error || !stories || stories.length === 0) {
    // Show "Your Story" button even if no stories
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
        {user && (
          <button
            onClick={onCreateStory}
            className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">Your Story</span>
          </button>
        )}
      </div>
    )
  }

  const handleStoryClick = (userStories: StoryWithUser) => {
    router.push(`/stories/${userStories.user_id}`)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
      {/* Your Story Button */}
      {user && (
        <button
          onClick={onCreateStory}
          className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Your Story</span>
        </button>
      )}

      {/* Other Users' Stories */}
      {stories.map((userStories) => (
        <button
          key={userStories.user_id}
          onClick={() => handleStoryClick(userStories)}
          className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer"
        >
          <div className="relative">
            {/* Gradient ring for unviewed, gray ring for viewed */}
            {userStories.has_unviewed ? (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-0.5">
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={userStories.avatar_url || undefined} alt={userStories.display_name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-sm">
                    {userStories.display_name?.[0]?.toUpperCase() || userStories.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-600 p-0.5">
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={userStories.avatar_url || undefined} alt={userStories.display_name} />
                  <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                    {userStories.display_name?.[0]?.toUpperCase() || userStories.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground max-w-[64px] truncate">
            {userStories.display_name || userStories.username}
          </span>
        </button>
      ))}
    </div>
  )
}

