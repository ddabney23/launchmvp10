import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// Custom error class
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public field?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Main error handler
export function handleApiError(error: unknown, context?: Record<string, unknown>) {
  console.error('API Error:', error)

  // Log to Sentry with context
  if (context) {
    Sentry.captureException(error, {
      extra: context,
    })
  } else {
    Sentry.captureException(error)
  }

  // Handle known ApiError
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        field: error.field,
      },
      { status: error.statusCode }
    )
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        issues: error.issues,
      },
      { status: 400 }
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message

    return NextResponse.json(
      {
        error: message,
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }

  // Unknown error
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    },
    { status: 500 }
  )
}

// Success response
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

// Common error helpers
export function validationError(message: string, field?: string) {
  throw new ApiError(400, message, 'VALIDATION_ERROR', field)
}

export function unauthorizedError(message = 'Unauthorized') {
  throw new ApiError(401, message, 'UNAUTHORIZED')
}

export function forbiddenError(message = 'Forbidden') {
  throw new ApiError(403, message, 'FORBIDDEN')
}

export function notFoundError(resource = 'Resource') {
  throw new ApiError(404, `${resource} not found`, 'NOT_FOUND')
}

export function conflictError(message: string) {
  throw new ApiError(409, message, 'CONFLICT')
}

export function tooManyRequestsError(retryAfter?: number) {
  const error = new ApiError(429, 'Too many requests', 'RATE_LIMIT_EXCEEDED')
  if (retryAfter) {
    // Add retry-after header in the route handler
  }
  throw error
}
