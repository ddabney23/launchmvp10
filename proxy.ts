import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from './lib/rate-limit'

const PUBLIC_PAGE_PATHS = [
  /^\/auth(\/.*)?$/,
  /^\/login(\/.*)?$/,
  /^\/register(\/.*)?$/,
]

const PROTECTED_PAGE_PATHS = [
  /^\/home(\/.*)?$/,
  /^\/feed(\/.*)?$/,
  /^\/profile(\/.*)?$/,
  /^\/settings(\/.*)?$/,
  /^\/marketplace(\/.*)?$/,
  /^\/cart(\/.*)?$/,
  /^\/checkout(\/.*)?$/,
  /^\/orders(\/.*)?$/,
  /^\/messages(\/.*)?$/,
  /^\/notifications(\/.*)?$/,
  /^\/groups(\/.*)?$/,
  /^\/vendor(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/onboarding(\/.*)?$/,
  /^\/create(\/.*)?$/,
  /^\/explore(\/.*)?$/,
  /^\/search(\/.*)?$/,
  /^\/rewards(\/.*)?$/,
  /^\/news(\/.*)?$/,
]

function matchesPath(pathname: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(pathname))
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  if (pathname.startsWith('/api/webhooks/')) return true
  if (pathname.startsWith('/api/auth')) return true
  if (pathname === '/auth/callback') return true
  if (pathname === '/api/health' && method === 'GET') return true
  if (pathname === '/api/health/cache' && method === 'GET') return true
  if (pathname === '/api/listings' && method === 'GET') return true
  if (pathname === '/api/ads' && method === 'GET') return true
  if (pathname === '/api/leaderboard' && method === 'GET') return true
  // Route handler enforces x-internal-api-secret
  if (pathname === '/api/gamification/update' && method === 'POST') return true
  return false
}

function requiresApiAuth(pathname: string, method: string): boolean {
  if (!pathname.startsWith('/api')) return false
  return !isPublicApiRoute(pathname, method)
}

function isProtectedPage(pathname: string): boolean {
  return matchesPath(pathname, PROTECTED_PAGE_PATHS)
}

function isPublicPage(pathname: string): boolean {
  return matchesPath(pathname, PUBLIC_PAGE_PATHS)
}

function isWriteOperation(pathname: string): boolean {
  const writePaths = ['/api/posts', '/api/comments', '/api/messages', '/api/listings', '/api/orders']
  return (
    writePaths.some((path) => pathname.includes(path)) &&
    (pathname.endsWith('/create') ||
      pathname.includes('/update') ||
      pathname.includes('/delete'))
  )
}

function getApiCorsOrigin(): string {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL']
  if (process.env.NODE_ENV === 'production') {
    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL must be set in production for CORS')
      return ''
    }
    return appUrl
  }
  return appUrl || 'http://localhost:3000'
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https: http:;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://accounts.google.com http://localhost:* ws://localhost:*;
    frame-src 'self' https://accounts.google.com;
    media-src 'self' https://res.cloudinary.com blob: data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, ' ')
    .trim()

  response.headers.set('Content-Security-Policy', cspHeader)

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  if (request.nextUrl.pathname.startsWith('/api')) {
    const corsOrigin = getApiCorsOrigin()
    if (corsOrigin) {
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Origin', corsOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      response.headers.set(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-internal-api-secret'
      )
    }
  }

  return response
}

export default async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  let response = applySecurityHeaders(supabaseResponse, request)

  if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/api')) {
    return new NextResponse(null, { status: 200, headers: response.headers })
  }

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')

  if (isApiRoute) {
    try {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        '127.0.0.1'

      const isWrite = isWriteOperation(pathname)
      const isSearch = pathname.includes('/search')
      const isUpload = pathname.includes('/upload')

      let rateLimitType: 'api' | 'write' | 'search' | 'upload' = 'api'
      if (isUpload) rateLimitType = 'upload'
      else if (isWrite) rateLimitType = 'write'
      else if (isSearch) rateLimitType = 'search'

      const identifier = user ? `user:${user.id}` : `ip:${ip}`
      const rateLimit = await checkRateLimit(identifier, rateLimitType)

      Object.entries(rateLimit.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      if (!rateLimit.success) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too many requests',
            message: 'You have exceeded the rate limit. Please try again later.',
            retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
              ...rateLimit.headers,
            },
          }
        )
      }
    } catch (error) {
      console.error('Rate limiting error:', error)
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Service temporarily unavailable', code: 'RATE_LIMIT_UNAVAILABLE' },
          { status: 503 }
        )
      }
    }
  }

  if (requiresApiAuth(pathname, request.method) && !user) {
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        message: 'Please sign in to continue',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    )
  }

  if (
    !isPublicPage(pathname) &&
    isProtectedPage(pathname) &&
    !user
  ) {
    const signInUrl = new URL('/auth', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
    '/api/:path*',
  ],
}
