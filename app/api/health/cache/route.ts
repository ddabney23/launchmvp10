/**
 * Cache Health Check API (non-production or secret-protected)
 * GET /api/health/cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkCacheHealth, getCacheStats } from '@/lib/cache'
import { productionDisabledResponse } from '@/lib/dev-only'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const disabled = productionDisabledResponse()
  if (disabled) return disabled

  const healthSecret = process.env.INTERNAL_HEALTH_SECRET
  if (healthSecret) {
    const provided = req.headers.get('x-internal-health-secret')
    if (provided !== healthSecret) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  try {
    const isHealthy = await checkCacheHealth()
    const stats = await getCacheStats()

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: isHealthy,
      timestamp: new Date().toISOString(),
      stats,
      redis_configured: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
