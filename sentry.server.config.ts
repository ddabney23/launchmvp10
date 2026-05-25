import * as Sentry from '@sentry/nextjs'

// Safely get env with fallbacks - use process.env directly to avoid validation errors
// Sentry is optional, so we don't want to fail if env validation fails
const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: sentryDsn,
  
  // Release version for tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
  
  // Performance monitoring
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  
  // Profiling (server-side only)
  profilesSampleRate: isProduction ? 0.1 : 1.0,
  
  // Debug mode
  debug: nodeEnv === 'development',
  
  environment: nodeEnv,
  
  // Server-side integrations only (NO replayIntegration on server!)
  integrations: [
    // Add server-specific integrations here if needed
  ],
  
  // Don't send personal data
  beforeSend(event) {
    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  },
})
