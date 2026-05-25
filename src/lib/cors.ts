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
  const allowOrigin = isDevelopment 
    ? (origin || '*')
    : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*')

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

