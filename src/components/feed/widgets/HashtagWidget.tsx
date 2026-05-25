import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { getTrendingHashtags, type Hashtag } from "@/lib/api"
import Link from "next/link"
import { Loader2, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

interface HashtagWidgetProps {
  limit?: number
  className?: string
}

export function HashtagWidget({ limit = 8, className }: HashtagWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["hashtags", limit],
    queryFn: () => getTrendingHashtags(limit),
  })

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
          <Hash className="h-4 w-4" />
          Trending Hashtags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading hashtags...
          </div>
        )}
        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">No trending hashtags yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {(data || []).map((hashtag: Hashtag) => (
            <Link
              key={hashtag.id}
              href={`/hashtags/${encodeURIComponent(hashtag.tag)}`}
              className="px-3 py-1 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              #{hashtag.tag}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

