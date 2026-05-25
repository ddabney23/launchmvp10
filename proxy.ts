import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkRateLimit } from './lib/rate-limit'

const PUBLIC_PATHS = [
  /^\/auth(\/.*)?$/,
  /^\/auth\/callback$/,
  /^\/login(\/.*)?$/,
  /^\/register(\/.*)?$/,
  /^\/api\/webhooks(\/.*)?$/,
  /^\/api\/health(\/.*)?$/,
  /^\/api\/test-auth(\/.*)?$/,
]

const PROTECTED_PATHS = [
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
  /^\/api\/admin(\/.*)?$/,
  /^\/api\/posts(\/.*)?$/,
  /^\/api\/stories(\/.*)?$/,
  /^\/api\/listings(\/.*)?$/,
]

function matchesPath(pathname: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(pathname))
}

function isPublicRoute(pathname: string) {
  if (pathname === '/api/listings' || pathname.startsWith('/api/listings/')) {
    return true
  }
  return matchesPath(pathname, PUBLIC_PATHS)
}

function isProtectedRoute(pathname: string) {
  return matchesPath(pathname, PROTECTED_PATHS)
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
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set(
      'Access-Control-Allow-Origin',
      process.env['NEXT_PUBLIC_APP_URL'] || '*'
    )
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    )
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
  const isUploadRoute = pathname === '/api/upload'
  const isListingsGet = pathname === '/api/listings' && request.method === 'GET'
  const isListingsPost = pathname === '/api/listings' && request.method === 'POST'

  if (isUploadRoute) {
    return response
  }

  if (isApiRoute && !isUploadRoute) {
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
    }
  }

  if (isListingsPost) {
    return response
  }

  if (
    !isPublicRoute(pathname) &&
    !isListingsGet &&
    isProtectedRoute(pathname) &&
    !user
  ) {
    if (isApiRoute) {
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
