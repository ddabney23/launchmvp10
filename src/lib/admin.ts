/**
 * Admin utility functions
 * Checks if a user is an admin based on email address
 */

/**
 * Check if an email address belongs to an admin
 * @param email - The email address to check
 * @returns true if the email is an admin email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Specific admin email
  if (email.toLowerCase() === "ddabney23@gmail.com") {
    return true;
  }
  
  // Pattern-based admin check (for development/testing)
  if (email.includes("@admin") || email.includes("admin@")) {
    return true;
  }
  
  return false;
}

/**
 * Get admin emails list (for reference)
 */
export const ADMIN_EMAILS = [
  "ddabney23@gmail.com",
] as const;

