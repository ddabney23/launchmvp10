'use client'

/**
 * Optimized Image Component
 * Provides image optimization, lazy loading, and responsive images
 */

import { useState, useEffect, useRef, ImgHTMLAttributes } from "react";
import { getOptimizedImageUrl, getBestImageFormat } from "@/lib/imageOptimization";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  placeholder?: string;
  lazy?: boolean;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  className,
  placeholder,
  lazy = true,
  priority = false,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(!lazy || priority);

  useEffect(() => {
    if (!isInView && lazy) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer.disconnect();
            }
          });
        },
        { rootMargin: "50px" }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => observer.disconnect();
    }
  }, [lazy, isInView]);

  useEffect(() => {
    if (isInView && src) {
      const format = getBestImageFormat();
      const optimizedSrc = getOptimizedImageUrl(src, {
        width,
        height,
        quality,
        format,
      });
      setImageSrc(optimizedSrc);
    }
  }, [isInView, src, width, height, quality]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
        style={{ width, height }}
      >
        <span className="text-xs">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)} style={{ width, height }}>
      {isLoading && (
        <Skeleton
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      {placeholder && isLoading && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 object-cover blur-sm"
          aria-hidden="true"
        />
      )}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          loading={lazy && !priority ? "lazy" : "eager"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className
          )}
          {...props}
        />
      )}
    </div>
  );
}

