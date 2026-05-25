'use client'

import { Award, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Badge as BadgeType } from "@/lib/types";

interface BadgeDisplayProps {
  badge: BadgeType;
  className?: string;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

export function BadgeDisplay({ badge, className, size = "md", showDescription = false }: BadgeDisplayProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("rounded-full bg-primary/10 flex items-center justify-center", sizeClasses[size])}>
        {badge.icon ? (
          <img src={badge.icon} alt={badge.name} className={cn("rounded-full", sizeClasses[size])} />
        ) : (
          <Award className={cn("text-primary", size === "sm" ? "h-3 w-3" : size === "md" ? "h-4 w-4" : "h-6 w-6")} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base")}>
          {badge.name}
        </p>
        {showDescription && badge.description && (
          <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
        )}
      </div>
    </div>
  );
}

interface BadgeListProps {
  badges: (BadgeType & { awarded_at?: string })[];
  maxDisplay?: number;
  className?: string;
}

export function BadgeList({ badges, maxDisplay = 5, className }: BadgeListProps) {
  const displayBadges = badges.slice(0, maxDisplay);

  return (
    <div className={cn("space-y-2", className)}>
      {displayBadges.map((badge) => (
        <BadgeDisplay key={badge.id} badge={badge} size="sm" showDescription />
      ))}
    </div>
  );
}

