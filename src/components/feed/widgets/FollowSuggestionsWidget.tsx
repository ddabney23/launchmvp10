import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { followUser, getFollowSuggestions } from "@/lib/api"
import type { Profile } from "@/lib/types"
import { Loader2, UserPlus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface FollowSuggestionsWidgetProps {
  currentUserId?: string
  limit?: number
  className?: string
}

export function FollowSuggestionsWidget({ currentUserId, limit = 5, className }: FollowSuggestionsWidgetProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data, isLoading } = useQuery({
    queryKey: ["followSuggestions", limit],
    queryFn: () => getFollowSuggestions(limit * 2),
  })

  const filtered = (data || []).filter((profile) => profile.id !== currentUserId).slice(0, limit)

  const followMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!currentUserId) {
        throw new Error("Not authenticated")
      }
      return followUser({ follower: currentUserId, following: profileId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followSuggestions"] })
      toast({ title: "Followed!" })
    },
    onError: () => {
      toast({ title: "Failed to follow", variant: "destructive" })
    },
  })

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          People you may know
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading suggestions...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No suggestions available.</p>
        )}

        {filtered.map((profile: Profile) => (
          <div key={profile.id} className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>{profile.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${profile.id}`} className="text-sm font-semibold hover:underline truncate block">
                {profile.display_name || profile.username}
              </Link>
              <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => followMutation.mutate(profile.id)}
              disabled={followMutation.isPending || !currentUserId}
            >
              {followMutation.isPending ? "..." : "Follow"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

