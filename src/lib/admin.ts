/**
 * Admin utility functions
 * Admin status is controlled by the profiles.is_admin database flag.
 */

/**
 * Legacy compatibility shim for older components.
 * Admin authorization must come from profiles.is_admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  void email;
  return false;
}

/**
 * Legacy compatibility list. Keep empty to avoid client-side admin bypasses.
 */
export const ADMIN_EMAILS = [] as const;

