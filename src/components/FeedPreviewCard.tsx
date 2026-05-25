'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { PostWithAuthor } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface FeedPreviewCardProps {
  post: PostWithAuthor
}

export function FeedPreviewCard({ post }: FeedPreviewCardProps) {
  const author = post.author_profile
  const createdAt = post.created_at ? new Date(post.created_at) : null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback>{author?.username?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {author?.display_name || author?.username || 'User'}
          </p>
          {createdAt && (
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
          )}
        </div>
      </div>
      {post.content && (
        <p className="text-sm text-muted-foreground line-clamp-3">{post.content}</p>
      )}
      <Link href="/feed" className="text-xs text-primary hover:underline">
        Open in Feed
      </Link>
    </div>
  )
}
