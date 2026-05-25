/**
 * Centralized logging utility with Sentry integration
 * 
 * Provides consistent logging across the application with automatic
 * error tracking in production environments.
 */

import * as Sentry from '@sentry/nextjs'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

/**
 * Main logger object with methods for different log levels
 */
export const logger = {
  /**
   * Debug level logging (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, context || '')
    }
  },

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    console.info(`[INFO] ${message}`, context || '')
    
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureMessage(message, {
        level: 'info',
        extra: context,
      })
    }
  },

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context || '')
    
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
      })
    }
  },

  /**
   * Error level logging with Sentry capture
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, error, context || '')
    
    // Always capture errors to Sentry (if configured)
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: {
          message,
          ...context,
        },
      })
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: {
          error,
          ...context,
        },
      })
    }
  },

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case 'debug':
        logger.debug(message, context)
        break
      case 'info':
        logger.info(message, context)
        break
      case 'warn':
        logger.warn(message, context)
        break
      case 'error':
        logger.error(message, undefined, context)
        break
    }
  },
}

/**
 * Create a scoped logger with a specific context prefix
 */
export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${scope}] ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logger.info(`[${scope}] ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logger.warn(`[${scope}] ${message}`, context),
    error: (message: string, error?: unknown, context?: LogContext) =>
      logger.error(`[${scope}] ${message}`, error, context),
  }
}
