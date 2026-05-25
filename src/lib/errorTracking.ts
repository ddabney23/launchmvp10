/**
 * Error Tracking Utility
 * 
 * Centralized error tracking that can be easily integrated with services like Sentry.
 * Uses logger utility for consistent logging.
 */

import { logger } from './logger'

interface ErrorContext {
  [key: string]: any;
  componentStack?: string;
  errorBoundary?: boolean;
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: string;
}

let errorTrackingEnabled = true;
let errorTrackingService: "console" | "sentry" | "custom" = "console";

/**
 * Initialize error tracking
 */
export function initErrorTracking(options?: {
  enabled?: boolean;
  service?: "console" | "sentry" | "custom";
  dsn?: string;
}) {
  if (options?.enabled !== undefined) {
    errorTrackingEnabled = options.enabled;
  }

  if (options?.service) {
    errorTrackingService = options.service;
  }

  // Initialize Sentry if configured
  if (options?.service === "sentry" && options?.dsn) {
    // Uncomment when @sentry/react is installed:
    // import * as Sentry from "@sentry/react";
    // Sentry.init({
    //   dsn: options.dsn,
    //   environment: process.env.NODE_ENV,
    //   integrations: [
    //     new Sentry.BrowserTracing(),
    //     new Sentry.Replay(),
    //   ],
    //   tracesSampleRate: 1.0,
    //   replaysSessionSampleRate: 0.1,
    //   replaysOnErrorSampleRate: 1.0,
    // });
    logger.info("Sentry would be initialized here", { service: 'sentry' });
  }

  // Set up global error handlers
  if (errorTrackingEnabled) {
    window.addEventListener("error", (event) => {
      logError(event.error, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      // Skip known benign errors (already handled in app/layout.tsx)
      const reason = event.reason;
      const msg =
        reason && typeof reason === "object"
          ? (reason.message as string | undefined) ?? String(reason)
          : String(reason);
      if (
        typeof msg === "string" &&
        msg.includes("Could not establish connection. Receiving end does not exist")
      ) {
        return;
      }

      logError(
        reason instanceof Error ? reason : new Error(String(reason)),
        {
          unhandledRejection: true,
        }
      );
    });
  }
}

/**
 * Log an error with context
 */
export function logError(error: Error | unknown, context: ErrorContext = {}) {
  if (!errorTrackingEnabled) return;

  // Normalize error to Error object if needed
  let normalizedError: Error;
  if (error instanceof Error) {
    normalizedError = error;
  } else if (error && typeof error === 'object') {
    // Try to extract error information from object
    normalizedError = new Error(
      (error as any).message || 
      (error as any).error?.message || 
      String(error) || 
      'Unknown error'
    );
    if ((error as any).stack) {
      normalizedError.stack = (error as any).stack;
    }
    if ((error as any).name) {
      normalizedError.name = (error as any).name;
    }
  } else {
    normalizedError = new Error(String(error || 'Unknown error'));
  }

  const errorContext: ErrorContext = {
    ...context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    errorName: normalizedError.name,
    errorMessage: normalizedError.message,
    errorStack: normalizedError.stack,
    originalError: error, // Keep original for debugging
  };

  // Get user ID from localStorage or session if available
  try {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem("sb-auth-token");
      if (session) {
        const parsed = JSON.parse(session);
        errorContext.userId = parsed?.user?.id;
      }
    }
  } catch {
    // Ignore errors parsing session
  }

  switch (errorTrackingService) {
    case "console":
      logger.error("Error tracked", normalizedError, errorContext);
      break;

    case "sentry":
      // Uncomment when @sentry/react is installed:
      // import * as Sentry from "@sentry/react";
      // Sentry.captureException(error, {
      //   contexts: {
      //     custom: errorContext,
      //   },
      // });
      logger.error("Error tracked (Sentry)", error, errorContext);
      break;

    case "custom":
      // Custom error tracking implementation
      // You can send to your own API endpoint here
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
          },
          context: errorContext,
        }),
      }).catch((err) => {
        logger.error("Failed to send error to tracking service", err);
      });
      break;
  }
}

/**
 * Log a warning
 */
export function logWarning(message: string, context: ErrorContext = {}) {
  if (!errorTrackingEnabled) return;

  const warningContext = {
    ...context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  logger.warn(message, warningContext);

  // If using Sentry, you can log warnings too:
  // Sentry.captureMessage(message, "warning");
}

/**
 * Log info/debug messages
 */
export function logInfo(message: string, context: ErrorContext = {}) {
  logger.info(message, context);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, userData?: Record<string, any>) {
  if (errorTrackingService === "sentry") {
    // Uncomment when @sentry/react is installed:
    // Sentry.setUser({
    //   id: userId,
    //   ...userData,
    // });
    logger.info("User context set", { userId, userData });
  }
}

/**
 * Clear user context
 */
export function clearUserContext() {
  if (errorTrackingService === "sentry") {
    // Uncomment when @sentry/react is installed:
    // Sentry.setUser(null);
    logger.info("User context cleared");
  }
}

