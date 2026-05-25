/**
 * Unified API Client Helper
 * 
 * Provides consistent API calling patterns with Clerk authentication
 * and standardized response handling.
 */

import { ApiError } from './types'

export interface ApiClientOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  params?: Record<string, string>
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
  message?: string
}

/**
 * Unified API client for making authenticated requests
 * Handles Clerk authentication automatically via cookies
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    params = {},
  } = options

  // Build URL with query parameters
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  // Prepare request options
  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include cookies for Clerk auth
  }

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body)
  }

  // Make request
  const response = await fetch(url.toString(), requestOptions)
  const result: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: 'Failed to parse response',
  }))

  // Handle errors
  if (!response.ok) {
    throw new ApiError(
      result.error || `HTTP ${response.status}: ${response.statusText}`,
      result.code || 'API_ERROR',
      response.status
    )
  }

  // Handle success response
  // Backend returns: { success: true, data: T }
  // Return the data directly for convenience
  if (result.success && result.data !== undefined) {
    return result.data as T
  }

  // Fallback: return the entire result if data is not present
  // (some endpoints might return data at root level for backward compatibility)
  return result as unknown as T
}

/**
 * Helper for GET requests
 */
export async function apiGet<T = unknown>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'GET', params })
}

/**
 * Helper for POST requests
 */
export async function apiPost<T = unknown>(
  endpoint: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'POST', body, params })
}

/**
 * Helper for PATCH requests
 */
export async function apiPatch<T = unknown>(
  endpoint: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'PATCH', body, params })
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete<T = unknown>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  return apiClient<T>(endpoint, { method: 'DELETE', params })
}

