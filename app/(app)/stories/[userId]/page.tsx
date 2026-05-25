'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getStories, type StoryWithUser } from '@/lib/api'
import { StoryViewer } from '@/components/stories/StoryViewer'
import { useEffect, useState } from 'react'

export default function StoryPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const { data: stories, isLoading } = useQuery<StoryWithUser[]>({
    queryKey: ['stories'],
    queryFn: getStories,
  })

  const [userIndex, setUserIndex] = useState(-1)
  const [storyIndex, setStoryIndex] = useState(0)

  // Find the user index in stories array
  useEffect(() => {
    if (stories && userId) {
      const index = stories.findIndex((s) => s.user_id === userId)
      if (index !== -1) {
        setUserIndex(index)
      } else {
        // User not found, redirect to feed - defer to avoid state update during render
        setTimeout(() => {
          router.push('/feed')
        }, 0)
      }
    }
  }, [stories, userId, router])

  const handleClose = () => {
    router.push('/feed')
  }

  if (isLoading || userIndex === -1) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading story...</div>
      </div>
    )
  }

  if (!stories || stories.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">No stories available</div>
      </div>
    )
  }

  return (
    <StoryViewer
      stories={stories}
      initialUserIndex={userIndex}
      initialStoryIndex={storyIndex}
      onClose={handleClose}
    />
  )
}

