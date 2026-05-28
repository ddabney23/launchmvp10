import { NextRequest } from 'next/server'

/**
 * Server-to-server calls only (gamification, cron, etc.).
 * Set INTERNAL_API_SECRET in .env.local — never expose to the browser.
 */
export function verifyInternalApiSecret(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    return false
  }
  const header = req.headers.get('x-internal-api-secret')
  return header !== null && header === secret
}
