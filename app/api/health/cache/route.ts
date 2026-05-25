/**
 * Cache Health Check API
 * GET /api/health/cache - Check Redis cache health and statistics
 */

import { NextResponse } from 'next/server'
import { checkCacheHealth, getCacheStats } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const isHealthy = await checkCacheHealth()
    const stats = await getCacheStats()
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      connected: isHealthy,
      timestamp: new Date().toISOString(),
      stats,
      redis_url: process.env.UPSTASH_REDIS_REST_URL ? 'configured' : 'missing',
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
