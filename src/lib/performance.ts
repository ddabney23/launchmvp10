/**
 * Performance Monitoring and Optimization Utilities
 */

import { cache } from 'react'
import { logger } from './logger'

/**
 * Measures the execution time of a function
 * @param label - Label for the performance measurement
 * @returns Cleanup function to end measurement
 */
export function measurePerformance(label: string) {
  const start = performance.now()
  
  return () => {
    const duration = performance.now() - start
    
    logger.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` })
    
    // Send to analytics in production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Track performance metric
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: label,
          value: Math.round(duration),
          event_category: 'Performance',
        })
      }
    }
    
    return duration
  }
}

/**
 * Cached data fetcher
 * React cache for deduplicating data fetches
 */
export const getCachedData = cache(async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  const endMeasure = measurePerformance(`Cache fetch: ${key}`)
  
  try {
    const data = await fetcher()
    return data
  } finally {
    endMeasure()
  }
})

/**
 * Debounce function
 * Delays function execution until after wait time has elapsed
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function
 * Limits function execution to once per specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Lazy load images with Intersection Observer
 */
export function lazyLoadImage(img: HTMLImageElement) {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const image = entry.target as HTMLImageElement
          const src = image.dataset.src
          
          if (src) {
            image.src = src
            image.removeAttribute('data-src')
            observer.unobserve(image)
          }
        }
      })
    })
    
    observer.observe(img)
    
    return () => observer.unobserve(img)
  } else {
    // Fallback for browsers without Intersection Observer
    const src = img.dataset.src
    if (src) {
      img.src = src
      img.removeAttribute('data-src')
    }
  }
}

/**
 * Report Web Vitals to analytics
 */
export function reportWebVitals(metric: any) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_label: metric.id,
      non_interaction: true,
    })
  }
  
  // Log Web Vitals
  logger.debug('Web Vital', { name: metric.name, value: metric.value, id: metric.id })
}

/**
 * Preload resources
 */
export function preloadResource(href: string, as: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = as
    link.href = href
    document.head.appendChild(link)
  }
}

/**
 * Check if code is running on slow connection
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false
  }
  
  const connection = (navigator as any).connection
  
  return (
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  )
}

/**
 * Optimize image loading based on connection speed
 */
export function getOptimalImageQuality(): number {
  if (isSlowConnection()) {
    return 60 // Lower quality for slow connections
  }
  return 85 // Higher quality for fast connections
}

/**
 * Batch updates using requestAnimationFrame
 */
export function batchUpdates(callback: () => void) {
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback)
    })
  } else {
    callback()
  }
}

/**
 * Virtual scroll calculation
 */
export function calculateVisibleRange(
  scrollTop: number,
  itemHeight: number,
  containerHeight: number,
  totalItems: number,
  overscan: number = 3
) {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const end = Math.min(
    totalItems,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )
  
  return { start, end }
}

/**
 * Memory usage monitoring (development only)
 */
export function monitorMemory() {
  if (
    typeof window !== 'undefined' &&
    'memory' in performance &&
    process.env.NODE_ENV === 'development'
  ) {
    const memory = (performance as any).memory
    
    logger.debug('Memory usage', {
      used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      usage: `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2)}%`,
    })
  }
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

