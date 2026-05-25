import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { getAdsByPlacement, type Ad } from "@/lib/api"
import { Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface AdsWidgetProps {
  placement: "home" | "feed" | "marketplace" | "news" | "notifications"
  limit?: number
  className?: string
}

export function AdsWidget({ placement, limit = 2, className }: AdsWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["ads", placement],
    queryFn: () => getAdsByPlacement(placement),
  })

  const ads = (data || []).slice(0, limit)

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground">Sponsored</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading ads...
          </div>
        )}

        {!isLoading && ads.length === 0 && (
          <p className="text-sm text-muted-foreground">No ads available right now.</p>
        )}

        {ads.map((ad: Ad) => (
          <div key={ad.id} className="space-y-2 rounded-lg border bg-muted/20 p-3">
            {ad.image_url && (
              <div className="relative h-32 w-full overflow-hidden rounded-md">
                <Image
                  src={ad.image_url}
                  alt={ad.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">{ad.title}</h4>
              {ad.description && (
                <p className="text-xs text-muted-foreground">{ad.description}</p>
              )}
            </div>
            {ad.cta_url && (
              <Button asChild size="sm" className="w-full">
                <Link href={ad.cta_url} target="_blank">
                  {ad.cta_text || "Learn More"}
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

