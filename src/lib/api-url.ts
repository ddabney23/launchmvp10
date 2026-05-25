/**
 * Resolve API paths for client-side fetch (same-origin in browser, APP_URL on server).
 */
export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${normalized}`
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${normalized}`
}
