'use client'

import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface VerifiedVendorBadgeProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline"
  showIcon?: boolean
}

export function VerifiedVendorBadge({ 
  className, 
  size = "md",
  variant = "default",
  showIcon = true 
}: VerifiedVendorBadgeProps) {
  const sizeClasses = {
    sm: "text-[10px] sm:text-xs px-1.5 py-0.5",
    md: "text-xs sm:text-sm px-2 py-1",
    lg: "text-sm sm:text-base px-3 py-1.5",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  return (
    <Badge 
      variant={variant} 
      className={cn(
        "bg-primary text-primary-foreground whitespace-nowrap flex-shrink-0",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        <CheckCircle2 className={cn("mr-1 flex-shrink-0", iconSizes[size])} />
      )}
      <span className="hidden sm:inline">Verified Vendor</span>
      <span className="sm:hidden">Verified</span>
    </Badge>
  )
}

