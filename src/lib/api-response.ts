/**
 * Standardized API response utilities
 * 
 * All API responses follow this structure (Answer 5: A):
 * - Success: { success: true, data: T, message?: string }
 * - Error: { success: false, error: string, code?: string, details?: unknown }
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from './logger'

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
}

/**
 * Standard API response (union type)
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// SUCCESS RESPONSE HELPERS
// ============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(message && { message }),
    },
    { status }
  )
}

/**
 * Create a created response (201)
 */
export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, message, 201)
}

// ============================================================================
// ERROR RESPONSE HELPERS
// ============================================================================

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  code?: string,
  details?: unknown,
  status: number = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error,
      ...(code && { code }),
      ...(details && { details }),
    },
    { status }
  )
}

/**
 * Create an unauthorized response (401)
 */
export function unauthorizedResponse(
  error: string = 'Unauthorized',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return errorResponse(error, 'UNAUTHORIZED', details, 401)
}

/**
 * Create a forbidden response (403)
 */
export function forbiddenResponse(
  error: string = 'Forbidden',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return errorResponse(error, 'FORBIDDEN', details, 403)
}

/**
 * Create a not found response (404)
 */
export function notFoundResponse(
  error: string = 'Not found',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return errorResponse(error, 'NOT_FOUND', details, 404)
}

/**
 * Create a validation error response (400)
 */
export function validationErrorResponse(
  error: string | ZodError,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  if (error instanceof ZodError) {
    return errorResponse(
      'Validation failed',
      'VALIDATION_ERROR',
      {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      400
    )
  }

  return errorResponse(error, 'VALIDATION_ERROR', details, 400)
}

/**
 * Create an internal server error response (500)
 */
export function internalErrorResponse(
  error: string | Error,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error

  // Log the error
  logger.error('Internal server error', error, { details })

  return errorResponse(
    errorMessage,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development' ? details : undefined,
    500
  )
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate request body with Zod schema
 * Returns parsed data or throws validation error
 */
export function validateRequest<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof ZodError) {
      throw validationErrorResponse(error)
    }
    throw error
  }
}

/**
 * Safe JSON parse with error handling
 */
export async function safeJsonParse<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch (error) {
    logger.error('Failed to parse JSON', error)
    return null
  }
}

// ============================================================================
// ERROR HANDLING WRAPPER
// ============================================================================

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse<ApiResponse>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse>> => {
    try {
      return await handler(...args)
    } catch (error) {
      // If it's already a NextResponse (from our error helpers), return it
      if (error instanceof NextResponse) {
        return error
      }

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return validationErrorResponse(error)
      }

      // Handle unknown errors
      return internalErrorResponse(
        error instanceof Error ? error : new Error('Unknown error'),
        error
      )
    }
  }
}

