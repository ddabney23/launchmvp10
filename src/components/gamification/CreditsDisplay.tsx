'use client'

import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditsDisplayProps {
  credits: number;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function CreditsDisplay({ credits, className, showIcon = true, size = "md" }: CreditsDisplayProps) {
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
      {showIcon && <CreditCard className={cn("text-secondary", iconSizes[size])} />}
      <span className={cn("font-semibold text-secondary", sizeClasses[size])}>
        {credits.toLocaleString()}
      </span>
    </div>
  );
}

