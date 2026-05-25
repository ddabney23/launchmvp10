/**
 * Centralized Logging Utility
 * 
 * Provides consistent logging across the application with proper
 * error tracking integration for production environments.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production'
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Log an error message
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
      timestamp: new Date().toISOString(),
    }

    if (this.isProduction) {
      // In production, optionally send to error tracking service (e.g., Sentry)
      // To enable Sentry integration:
      // 1. Install: npm install @sentry/nextjs
      // 2. Initialize Sentry in app/layout.tsx or app/providers.tsx
      // 3. Uncomment the following code:
      // if (typeof window !== 'undefined' && (window as any).Sentry) {
      //   (window as any).Sentry.captureException(error || new Error(message), { extra: errorContext })
      // }
      
      // Log to console in production (consider replacing with error tracking service)
      console.error(`[ERROR] ${message}`, errorContext)
    } else {
      console.error(`[ERROR] ${message}`, errorContext)
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.warn(`[WARN] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      })
    }
    // In production, warnings are typically not logged unless critical
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.log(`[INFO] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, {
        ...context,
        timestamp: new Date().toISOString(),
      })
    }
  }
}

export const logger = new Logger()

