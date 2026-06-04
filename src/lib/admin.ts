/**
 * Client-side admin helpers are intentionally conservative.
 *
 * Admin authorization must come from server-owned profile data (`profiles.is_admin`),
 * not from email patterns or public environment variables that can drift from the
 * database policy enforced by API routes.
 */
export function isAdminEmail(_email: string | null | undefined): boolean {
  return false
}

export const ADMIN_EMAILS = [] as const

