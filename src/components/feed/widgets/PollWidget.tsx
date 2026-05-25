import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getActivePolls, voteOnPoll, type PollWithOptions } from "@/lib/api"
import { Loader2, BarChart2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface PollWidgetProps {
  className?: string
}

export function PollWidget({ className }: PollWidgetProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["activePolls"],
    queryFn: () => getActivePolls(3),
  })

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) => voteOnPoll(pollId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activePolls"] })
      toast({ title: "Vote recorded!" })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to vote right now"
      toast({ title: "Vote failed", description: message, variant: "destructive" })
    },
  })

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground flex items-center gap-2">
          <BarChart2 className="h-4 w-4" />
          Active Polls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading polls...
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">No active polls right now.</p>
        )}

        {(data || []).map((poll: PollWithOptions) => (
          <div key={poll.id} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{poll.question}</p>
            <div className="space-y-2">
              {(poll.options || []).map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => voteMutation.mutate({ pollId: poll.id, optionId: option.id })}
                  disabled={voteMutation.isPending}
                >
                  <span>{option.option_text}</span>
                  <span className="text-xs text-muted-foreground">{option.vote_count} votes</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

