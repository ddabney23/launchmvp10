'use client'

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PointsDisplayProps {
  points: number;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PointsDisplay({ points, className, showIcon = true, size = "md" }: PointsDisplayProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {showIcon && <Trophy className={cn("text-primary", iconSizes[size])} />}
      <span className={cn("font-semibold text-primary", sizeClasses[size])}>
        {points.toLocaleString()}
      </span>
    </div>
  );
}

