import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16 * 1024

export async function POST(req: NextRequest) {
  const rateLimitResponse = await checkRateLimit(req, 'anonymousWrite')
  if (rateLimitResponse) return rateLimitResponse

  const rawBody = await req.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  try {
    const event = rawBody ? JSON.parse(rawBody) : {}
    logger.info('Analytics event received', {
      event: typeof event?.event === 'string' ? event.event : 'unknown',
      path: typeof event?.path === 'string' ? event.path : undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
