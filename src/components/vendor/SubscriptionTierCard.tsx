'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Sparkles, Zap, Crown } from "lucide-react"
import { SUBSCRIPTION_TIERS, SubscriptionTier } from "@/lib/subscription-tiers"
import { cn } from "@/lib/utils"

interface SubscriptionTierCardProps {
  tier: SubscriptionTier
  isSelected?: boolean
  isCurrent?: boolean
  onSelect?: (tier: SubscriptionTier) => void
  disabled?: boolean
}

const tierIcons = {
  free: Sparkles,
  basic: Zap,
  pro: Crown,
  premium: Crown,
}

const tierColors = {
  free: "border-gray-300 bg-gray-50",
  basic: "border-blue-300 bg-blue-50",
  pro: "border-purple-300 bg-purple-50",
  premium: "border-amber-300 bg-amber-50",
}

export function SubscriptionTierCard({
  tier,
  isSelected = false,
  isCurrent = false,
  onSelect,
  disabled = false,
}: SubscriptionTierCardProps) {
  const config = SUBSCRIPTION_TIERS[tier]
  const Icon = tierIcons[tier]
  const isUnlimited = config.listingLimit === -1

  return (
    <Card
      className={cn(
        "relative transition-all cursor-pointer hover:shadow-lg",
        tierColors[tier],
        isSelected && "ring-2 ring-primary ring-offset-2",
        isCurrent && "ring-2 ring-green-500 ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && onSelect?.(tier)}
    >
      {isCurrent && (
        <Badge className="absolute top-2 right-2" variant="default">
          Current
        </Badge>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            <CardTitle className="text-lg">{config.name}</CardTitle>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {config.price === 0 ? "Free" : `$${config.price.toFixed(2)}`}
            </div>
            {config.price > 0 && (
              <div className="text-xs text-muted-foreground">per month</div>
            )}
          </div>
        </div>
        <CardDescription className="mt-2">
          {isUnlimited ? "Unlimited" : `${config.listingLimit} listings`} • {config.transactionFee}% transaction fee
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {config.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="capitalize">{feature.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
        {onSelect && !isCurrent && (
          <Button
            className="w-full mt-4"
            variant={isSelected ? "default" : "outline"}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(tier)
            }}
          >
            {isSelected ? "Selected" : tier === "free" ? "Select Free" : "Upgrade"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

