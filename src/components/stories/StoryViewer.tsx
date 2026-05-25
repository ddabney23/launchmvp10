'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, MessageCircle, Eye, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { recordStoryView, sendStoryReply, toggleStoryLike, getStoryLikeStatus, type StoryWithUser } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { Progress } from '@/components/ui/progress'
import { logger } from '@/lib/logger'

interface StoryViewerProps {
  stories: StoryWithUser[]
  initialUserIndex?: number
  initialStoryIndex?: number
  onClose: () => void
}

export function StoryViewer({
  stories,
  initialUserIndex = 0,
  initialStoryIndex = 0,
  onClose,
}: StoryViewerProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex)
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentUserStories = stories[currentUserIndex]?.stories || []
  const currentStory = currentUserStories[currentStoryIndex]
  const currentUser = stories[currentUserIndex]

  // Define nextStory before useEffect that uses it
  // Use a ref to track if we should close to avoid calling onClose during render
  const shouldCloseRef = useRef(false)
  
  const nextStory = useCallback(() => {
    if (currentStoryIndex < currentUserStories.length - 1) {
      // Next story from same user
      setCurrentStoryIndex(currentStoryIndex + 1)
      setProgress(0)
    } else if (currentUserIndex < stories.length - 1) {
      // Next user's first story
      setCurrentUserIndex(currentUserIndex + 1)
      setCurrentStoryIndex(0)
      setProgress(0)
    } else {
      // Last story, mark that we should close (don't call onClose directly)
      shouldCloseRef.current = true
    }
  }, [currentStoryIndex, currentUserIndex, currentUserStories.length, stories.length])

  // Handle closing when we reach the end - separate effect to avoid render issues
  useEffect(() => {
    if (shouldCloseRef.current) {
      shouldCloseRef.current = false
      // Defer navigation to avoid updating Router during render
      const timeoutId = setTimeout(() => {
        onClose()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [currentStoryIndex, currentUserIndex, onClose])

  // Record view when story is displayed
  const recordViewMutation = useMutation({
    mutationFn: recordStoryView,
    onSuccess: () => {
      // Invalidate stories query to update view status
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
  })

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (reply: { story_id: string; message: string }) => {
      return sendStoryReply(reply)
    },
    onSuccess: () => {
      setReplyText('')
      setShowReplyInput(false)
      toast({
        title: 'Reply sent!',
        description: 'Your reply has been sent.',
      })
      queryClient.invalidateQueries({ queryKey: ['stories'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send reply',
        description: error.message || 'Please try again',
        variant: 'destructive',
      })
    },
  })

  // Auto-advance story
  useEffect(() => {
    if (!currentStory || isPaused) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      return
    }

    // Determine duration (5 seconds for images, video duration for videos)
    const duration = currentStory.media_type === 'video' 
      ? 10000 // 10 seconds default for videos (you can extract actual duration)
      : 5000 // 5 seconds for images

    // Record view when story starts
    if (!currentStory.is_viewed) {
      recordViewMutation.mutate({ story_id: currentStory.id })
    }

    // Load like status (only if user is authenticated)
    if (user) {
      getStoryLikeStatus(currentStory.id)
        .then((status) => {
          setIsLiked(status.is_liked)
          setLikeCount(status.like_count)
        })
        .catch((error) => {
          logger.error('Failed to load like status', error)
        })
    } else {
      // Load like count only (no auth needed)
      getStoryLikeStatus(currentStory.id)
        .then((status) => {
          setLikeCount(status.like_count)
        })
        .catch((error) => {
          logger.error('Failed to load like count', error)
        })
    }

    // Reset progress
    setProgress(0)

    // Start progress timer
    const interval = 100 // Update every 100ms
    const increment = (100 / (duration / interval))

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + increment
        if (newProgress >= 100) {
          // Move to next story - defer to avoid state update during render
          setTimeout(() => {
            nextStory()
          }, 0)
          return 0
        }
        return newProgress
      })
    }, interval)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [currentStory, isPaused, nextStory])

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      // Previous story from same user
      setCurrentStoryIndex(currentStoryIndex - 1)
      setProgress(0)
    } else if (currentUserIndex > 0) {
      // Previous user's last story
      const prevUserStories = stories[currentUserIndex - 1]?.stories || []
      setCurrentUserIndex(currentUserIndex - 1)
      setCurrentStoryIndex(prevUserStories.length - 1)
      setProgress(0)
    }
  }

  const handleReply = () => {
    if (!replyText.trim() || !currentStory) {
      toast({
        title: 'Message required',
        description: 'Please enter a message',
        variant: 'destructive',
      })
      return
    }

    sendReplyMutation.mutate({
      story_id: currentStory.id,
      message: replyText.trim(),
    })
  }

  const handleSwipeDown = (e: React.TouchEvent) => {
    const startY = e.touches[0].clientY
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentY = moveEvent.touches[0].clientY
      const diff = currentY - startY
      
      if (diff > 100) {
        // Swiped down more than 100px, close viewer
        onClose()
        document.removeEventListener('touchmove', handleTouchMove)
      }
    }
    
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', () => {
      document.removeEventListener('touchmove', handleTouchMove)
    }, { once: true })
  }

  if (!currentStory || !currentUser) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleSwipeDown}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 p-2 z-10">
        <div className="flex gap-1">
          {currentUserStories.map((story, index) => (
            <div key={story.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  index < currentStoryIndex
                    ? 'bg-white'
                    : index === currentStoryIndex
                    ? 'bg-white'
                    : 'bg-white/30'
                }`}
                style={{
                  width: index === currentStoryIndex ? `${progress}%` : index < currentStoryIndex ? '100%' : '0%',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="absolute top-12 left-0 right-0 p-4 z-10 flex items-center justify-between">
        <button
          onClick={() => router.push(`/profile/${currentUser.user_id}`)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser.avatar_url || undefined} alt={currentUser.display_name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white">
              {currentUser.display_name?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-white font-semibold">{currentUser.display_name || currentUser.username}</div>
            <div className="text-white/70 text-sm">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
            </div>
          </div>
        </button>

        {/* View count for own stories */}
        {user && currentUser.user_id === user.id && (
          <div className="flex items-center gap-1 text-white/70 text-sm">
            <Eye className="w-4 h-4" />
            <span>{currentStory.view_count}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Story content */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Left tap zone - previous */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/3 z-20"
          onClick={previousStory}
          aria-label="Previous story"
        />

        {/* Story media */}
        <div className="w-full h-full flex items-center justify-center">
          {currentStory.media_type === 'image' ? (
            <img
              src={currentStory.media_url}
              alt={currentStory.caption || 'Story'}
              className="max-w-full max-h-full object-contain"
              onLoad={() => setIsPaused(false)}
            />
          ) : (
            <video
              src={currentStory.media_url}
              className="max-w-full max-h-full object-contain"
              autoPlay
              loop={false}
              onPlay={() => setIsPaused(false)}
              onPause={() => setIsPaused(true)}
              onEnded={nextStory}
            />
          )}
        </div>

        {/* Right tap zone - next */}
        <button
          className="absolute right-0 top-0 bottom-0 w-1/3 z-20"
          onClick={nextStory}
          aria-label="Next story"
        />
      </div>

      {/* Caption */}
      {currentStory.caption && (
        <div className="absolute bottom-20 left-0 right-0 p-4 z-10">
          <p className="text-white text-sm">{currentStory.caption}</p>
        </div>
      )}

      {/* Reply input */}
      {showReplyInput ? (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 z-10">
          <div className="flex gap-2">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleReply()
                }
              }}
              autoFocus
            />
            <Button
              onClick={handleReply}
              disabled={!replyText.trim() || sendReplyMutation.isPending}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!currentStory) return
              try {
                const result = await toggleStoryLike(currentStory.id)
                setIsLiked(result.liked)
                setLikeCount(result.like_count)
                toast({
                  title: result.liked ? 'Story liked!' : 'Story unliked',
                  description: result.liked ? 'You liked this story' : 'You unliked this story',
                })
              } catch (error) {
                toast({
                  title: 'Failed to like story',
                  description: error instanceof Error ? error.message : 'Please try again',
                  variant: 'destructive',
                })
              }
            }}
            className={`text-white hover:bg-white/20 ${isLiked ? 'text-red-500' : ''}`}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
            {likeCount > 0 && <span className="ml-1 text-sm">{likeCount}</span>}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReplyInput(true)}
            className="text-white hover:bg-white/20"
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Navigation arrows (desktop) */}
      <div className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={previousStory}
          className="text-white hover:bg-white/20"
          disabled={currentUserIndex === 0 && currentStoryIndex === 0}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      </div>

      <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={nextStory}
          className="text-white hover:bg-white/20"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>
    </div>
  )
}

