/**
 * Admin utility functions
 * Admin access is determined by profiles.is_admin in the database.
 */

/**
 * Deprecated compatibility helper. Keep returning false so old call sites do
 * not grant UI-only admin access that diverges from server authorization.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  void email;
  return false;
}

/**
 * Legacy export retained for imports; admin users must be managed in the DB.
 */
export const ADMIN_EMAILS = [] as const;

