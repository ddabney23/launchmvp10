import * as Sentry from '@sentry/nextjs'

// Safely get env with fallbacks - use process.env directly to avoid validation errors
// Sentry is optional, so we don't want to fail if env validation fails
const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: sentryDsn,
  release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',
  tracesSampleRate: isProduction ? 0.1 : 1.0,
  debug: nodeEnv === 'development',
  environment: nodeEnv,
})
