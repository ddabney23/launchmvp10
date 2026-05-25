/**
 * Analytics and Error Tracking
 * Centralized analytics and error tracking utilities
 */

import { logger } from './logger'

// Analytics event types
export type AnalyticsEvent =
  | "page_view"
  | "user_signup"
  | "user_login"
  | "user_logout"
  | "post_created"
  | "post_liked"
  | "listing_viewed"
  | "listing_purchased"
  | "search_performed"
  | "error_occurred";

interface AnalyticsEventData {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
  userId?: string;
  timestamp?: number;
}

class Analytics {
  private enabled: boolean;
  private sentryDsn: string | null;

  constructor() {
    this.enabled = process.env.NODE_ENV === 'production';
    this.sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || null;
    this.initializeSentry();
  }

  private initializeSentry() {
    if (this.sentryDsn && typeof window !== "undefined") {
      // Lazy load Sentry only if DSN is provided
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.init({
          dsn: this.sentryDsn!,
          integrations: [
            new Sentry.BrowserTracing(),
            new Sentry.Replay(),
          ],
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
          environment: process.env.NODE_ENV,
        });
      }).catch(() => {
        logger.warn("Failed to initialize Sentry");
      });
    }
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
    if (!this.enabled) {
      logger.debug("Analytics event", { event, properties });
      return;
    }

    const eventData: AnalyticsEventData = {
      event,
      properties,
      timestamp: Date.now(),
    };

    // Get user ID if available
    try {
      const userId = this.getUserId();
      if (userId) {
        eventData.userId = userId;
      }
    } catch {
      // Ignore errors getting user ID
    }

    // Send to analytics service (implement your preferred service)
    this.sendToAnalytics(eventData);

    // Also send to Sentry as breadcrumb
    if (this.sentryDsn && typeof window !== "undefined") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.addBreadcrumb({
          category: "analytics",
          message: event,
          level: "info",
          data: properties,
        });
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  /**
   * Track page view
   */
  pageView(path: string, title?: string) {
    this.track("page_view", {
      path,
      title: title || document.title,
    });
  }

  /**
   * Track error
   */
  error(error: Error, context?: Record<string, unknown>) {
    this.track("error_occurred", {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    });

    // Send to Sentry
    if (this.sentryDsn && typeof window !== "undefined") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error, {
          contexts: {
            custom: context || {},
          },
        });
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  /**
   * Set user context for analytics
   */
  setUser(userId: string, traits?: Record<string, unknown>) {
    if (this.sentryDsn && typeof window !== "undefined") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.setUser({
          id: userId,
          ...traits,
        });
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (this.sentryDsn && typeof window !== "undefined") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.setUser(null);
      }).catch(() => {
        // Sentry not available
      });
    }
  }

  private getUserId(): string | null {
    // Try to get user ID from sessionStorage or Supabase Auth
    try {
      const testUser = sessionStorage.getItem("test_mode_user");
      if (testUser) {
        const user = JSON.parse(testUser);
        return user.id;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private sendToAnalytics(data: AnalyticsEventData) {
    // Implement your analytics service integration here
    // Examples: Google Analytics, Mixpanel, Amplitude, etc.
    
    // Example: Send to custom analytics endpoint
    if (typeof window !== "undefined" && navigator.sendBeacon) {
      try {
        const endpoint = "/api/analytics";
        const blob = new Blob([JSON.stringify(data)], {
          type: "application/json",
        });
        navigator.sendBeacon(endpoint, blob);
      } catch {
        // Fallback to fetch if sendBeacon fails
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          keepalive: true,
        }).catch(() => {
          // Ignore errors
        });
      }
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  /**
   * Mark the start of a performance measurement
   */
  mark(name: string) {
    if (typeof performance !== "undefined") {
      this.marks.set(name, performance.now());
      performance.mark(name);
    }
  }

  /**
   * Measure the time between two marks
   */
  measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== "undefined") {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          const startTime = this.marks.get(startMark);
          if (startTime !== undefined) {
            const duration = performance.now() - startTime;
            performance.measure(name, { start: startTime });
            
            // Log slow operations
            if (duration > 1000) {
              logger.warn("Slow operation detected", { name, duration: `${duration.toFixed(2)}ms` });
            }
          }
        }
      } catch (error) {
        logger.warn("Performance measurement failed", { name, error });
      }
    }
  }

  /**
   * Get Web Vitals metrics
   */
  getWebVitals() {
    if (typeof window === "undefined") return;

    // Measure Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry;
      analytics.track("page_view", {
        lcp: lastEntry.startTime,
      });
    }).observe({ entryTypes: ["largest-contentful-paint"] });

    // Measure First Input Delay (FID)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        analytics.track("page_view", {
          fid: entry.processingStart - entry.startTime,
        });
      });
    }).observe({ entryTypes: ["first-input"] });

    // Measure Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      analytics.track("page_view", {
        cls: clsValue,
      });
    }).observe({ entryTypes: ["layout-shift"] });
  }
}

// Export singleton instances
export const analytics = new Analytics();
export const performanceMonitor = new PerformanceMonitor();

// Initialize Web Vitals on load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    performanceMonitor.getWebVitals();
  });
}

