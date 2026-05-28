import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify Shippo webhook requests.
 * Supports: Authorization Bearer token, ?token= query param, or HMAC-SHA256 hex signature.
 */
export function verifyShippoWebhook(
  rawBody: string,
  options: {
    secret: string
    authorizationHeader: string | null
    queryToken: string | null
    signatureHeader: string | null
  }
): boolean {
  const { secret, authorizationHeader, queryToken, signatureHeader } = options

  if (!secret) {
    return false
  }

  if (queryToken && timingSafeEqualString(queryToken, secret)) {
    return true
  }

  if (authorizationHeader) {
    const bearer = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : authorizationHeader
    if (timingSafeEqualString(bearer, secret)) {
      return true
    }
  }

  if (signatureHeader) {
    const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    return timingSafeEqualHex(expected, signatureHeader)
  }

  return false
}

function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function timingSafeEqualHex(expected: string, received: string): boolean {
  try {
    const bufA = Buffer.from(expected, 'hex')
    const bufB = Buffer.from(received, 'hex')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
