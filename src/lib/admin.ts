/**
 * Admin utility functions
 * Checks if a user is an admin based on configured email allowlists.
 */

function configuredAdminEmails(): string[] {
  const raw = [process.env['ADMIN_EMAIL'], process.env['ADMIN_EMAILS']]
    .filter(Boolean)
    .join(',')

  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Check if an email address belongs to a configured admin.
 * @param email - The email address to check
 * @returns true if the email is an admin email
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  return configuredAdminEmails().includes(email.toLowerCase());
}

/**
 * Get configured admin emails list (for reference)
 */
export const ADMIN_EMAILS = configuredAdminEmails();
