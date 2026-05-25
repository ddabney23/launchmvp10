/**
 * User-Friendly Error Messages
 * Converts technical errors into user-friendly messages
 */

export function getUserFriendlyError(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes("network") || message.includes("fetch")) {
      return "Network error. Please check your internet connection and try again.";
    }

    // Authentication errors
    if (message.includes("unauthorized") || message.includes("401")) {
      return "You need to log in to perform this action.";
    }

    if (message.includes("forbidden") || message.includes("403")) {
      return "You don't have permission to perform this action.";
    }

    // Not found errors
    if (message.includes("not found") || message.includes("404")) {
      return "The requested resource was not found.";
    }

    // Validation errors
    if (message.includes("validation") || message.includes("invalid")) {
      return "Please check your input and try again.";
    }

    // Rate limiting
    if (message.includes("rate limit") || message.includes("429")) {
      return "Too many requests. Please wait a moment and try again.";
    }

    // Server errors
    if (message.includes("500") || message.includes("server error")) {
      return "Server error. Please try again later.";
    }

    // Return the original message if it's user-friendly, otherwise generic
    if (message.length < 100 && !message.includes("error:") && !message.includes("failed")) {
      return error.message;
    }
  }

  // Handle objects with message property
  if (typeof error === "object" && error !== null && "message" in error) {
    const errorObj = error as { message: string };
    return getUserFriendlyError(new Error(errorObj.message));
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Get error title based on error type
 */
export function getErrorTitle(error: unknown): string {
  if (!error) {
    return "Error";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return "Connection Error";
    }

    if (message.includes("unauthorized") || message.includes("401")) {
      return "Authentication Required";
    }

    if (message.includes("forbidden") || message.includes("403")) {
      return "Access Denied";
    }

    if (message.includes("not found") || message.includes("404")) {
      return "Not Found";
    }

    if (message.includes("validation") || message.includes("invalid")) {
      return "Validation Error";
    }

    if (message.includes("rate limit") || message.includes("429")) {
      return "Too Many Requests";
    }
  }

  return "Error";
}

