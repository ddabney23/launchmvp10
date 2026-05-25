/**
 * Error Utilities
 * 
 * Helper functions for safely handling errors in TypeScript
 */

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unexpected error occurred'
}

/**
 * Safely extract error status code from unknown error type
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = error.status
    if (typeof status === 'number') {
      return status
    }
  }
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = error.statusCode
    if (typeof statusCode === 'number') {
      return statusCode
    }
  }
  return undefined
}

/**
 * Check if error is a specific type
 */
export function isErrorWithStatus(error: unknown, status: number): boolean {
  return getErrorStatus(error) === status
}

/**
 * Map error codes to user-friendly messages
 */
export function getErrorMessageForCode(code: string): string {
  const errorMessages: Record<string, string> = {
    // Supabase/Postgres errors
    '23505': 'This item already exists',
    '23503': 'Related item not found',
    '23502': 'Required field is missing',
    '42501': 'You do not have permission to perform this action',
    'PGRST116': 'No data found',
    'PGRST301': 'You do not have permission to access this resource',
    
    // Stripe errors
    'card_declined': 'Your card was declined. Please try a different payment method.',
    'insufficient_funds': 'Insufficient funds. Please use a different card.',
    'expired_card': 'Your card has expired. Please use a different payment method.',
    'incorrect_cvc': 'The card security code is incorrect.',
    'processing_error': 'An error occurred while processing your card. Please try again.',
    
    // Custom app errors
    'UNAUTHENTICATED': 'Please sign in to continue',
    'PROFILE_NOT_FOUND': 'Your profile could not be found. Please complete your profile.',
    'FORBIDDEN': 'You do not have permission to perform this action',
    'NOT_FOUND': 'The requested item was not found',
    'VENDOR_NOT_VERIFIED': 'You must be a verified vendor to perform this action',
    'BOOKING_CONFLICT': 'This time slot is already booked',
  }
  
  return errorMessages[code] || 'An unexpected error occurred'
}

/**
 * Get detailed error message with actionable guidance
 */
export function getDetailedError(error: unknown): { title: string; message: string; action?: string } {
  const message = getErrorMessage(error)
  const status = getErrorStatus(error)
  
  // Extract error code if available
  let code = ''
  if (error && typeof error === 'object' && 'code' in error) {
    code = String(error.code)
  }
  
  // Authentication errors
  if (status === 401 || message.includes('authenticated') || message.includes('UNAUTHENTICATED')) {
    return {
      title: 'Authentication Required',
      message: 'Please sign in to continue',
      action: 'Sign In'
    }
  }
  
  // Permission errors
  if (status === 403 || code === '42501' || message.includes('FORBIDDEN') || message.includes('permission')) {
    return {
      title: 'Permission Denied',
      message: 'You do not have permission to perform this action. Please ensure your email is confirmed and you have the correct role.',
      action: 'Contact Support'
    }
  }
  
  // Not found errors
  if (status === 404 || code === 'PGRST116' || message.includes('NOT_FOUND')) {
    return {
      title: 'Not Found',
      message: 'The requested item could not be found',
      action: 'Go Back'
    }
  }
  
  // Validation errors
  if (status === 400 || status === 422) {
    return {
      title: 'Invalid Input',
      message: message || 'Please check your input and try again',
      action: 'Review Form'
    }
  }
  
  // Server errors
  if (status && status >= 500) {
    return {
      title: 'Server Error',
      message: 'Something went wrong on our end. Please try again later.',
      action: 'Retry'
    }
  }
  
  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Retry'
    }
  }
  
  // Default
  return {
    title: 'Error',
    message: message || 'An unexpected error occurred',
    action: 'Try Again'
  }
}

