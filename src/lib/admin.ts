/**
 * Admin UI helpers.
 * Server authorization must use profiles.is_admin via API routes (requireAdminUserId).
 */

/**
 * @deprecated Use profile.is_admin from the API — never grant admin from email patterns.
 */
export function isAdminEmail(_email: string | null | undefined): boolean {
  return false
}
