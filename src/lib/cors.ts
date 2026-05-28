/**
 * CORS Utilities
 * 
 * Provides CORS header configuration for API routes
 */

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // In development, allow all origins
  // In production, check against allowed list
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const allowOrigin = isDevelopment
    ? origin || appUrl || 'http://localhost:3000'
    : origin && allowedOrigins.includes(origin)
      ? origin
      : appUrl || allowedOrigins[0] || ''

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(origin?: string | null) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  })
}

