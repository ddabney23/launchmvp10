/**
 * User ID helpers — profiles.id matches auth.users.id (UUID).
 */

export function isUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/** @deprecated Clerk IDs no longer used; returns id when valid UUID */
export function isClerkId(_id: string): boolean {
  return false
}

/** Profile UUID is the auth user id */
export async function ensureProfileUuid(userId: string): Promise<string> {
  if (!isUuid(userId)) {
    throw new Error(`Invalid profile id: ${userId}`)
  }
  return userId
}

export async function getProfileUuid(userId: string): Promise<string | null> {
  return isUuid(userId) ? userId : null
}
