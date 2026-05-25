import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { getUserGroups } from "@/lib/api"
import type { Group } from "@/lib/types"
import Link from "next/link"
import { Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface GroupsWidgetProps {
  userId?: string
  className?: string
}

export function GroupsWidget({ userId, className }: GroupsWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["groupsWidget", userId],
    queryFn: () => {
      if (!userId) {
        return Promise.resolve([]);
      }
      return getUserGroups(userId);
    },
    enabled: !!userId,
  })

  const groups = (data || []).slice(0, 5)

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Groups you&apos;re in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!userId && <p className="text-sm text-muted-foreground">Sign in to see your groups.</p>}

        {userId && isLoading && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading groups...
          </div>
        )}

        {userId && !isLoading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">You haven&apos;t joined any groups yet.</p>
        )}

        {groups.map((group: Group) => (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="block rounded-md border border-transparent px-3 py-2 text-sm hover:border-primary/50 hover:bg-muted transition-colors"
          >
            <p className="font-semibold truncate">{group.name}</p>
            {group.description && (
              <p className="text-xs text-muted-foreground truncate">{group.description}</p>
            )}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

