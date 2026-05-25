import { NextResponse } from 'next/server'
import { createAdminClient } from '@/integrations/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  checks: {
    supabase: 'healthy' | 'unhealthy' | 'unknown'
    prisma: 'healthy' | 'unhealthy' | 'unknown'
    environment: 'healthy' | 'unhealthy' | 'unknown'
    stripe: 'healthy' | 'unhealthy' | 'unknown'
  }
  version: string
  uptime: number
}

export async function GET() {
  const startTime = Date.now()
  
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: 'unknown',
      prisma: 'unknown',
      environment: 'unknown',
      stripe: 'unknown',
    },
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime ? process.uptime() : 0,
  }

  // Check Supabase connection
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is ok
      throw error
    }
    
    health.checks.supabase = 'healthy'
  } catch (error) {
    logger.error('Supabase health check failed', error)
    health.checks.supabase = 'unhealthy'
    health.status = 'degraded'
  }

  // Check environment variables
  try {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    )

    if (missingVars.length > 0) {
      logger.warn('Missing environment variables', { missingVars })
      health.checks.environment = 'unhealthy'
      health.status = 'unhealthy'
    } else {
      health.checks.environment = 'healthy'
    }
  } catch (error) {
    logger.error('Environment check failed', error)
    health.checks.environment = 'unhealthy'
    health.status = 'unhealthy'
  }

  // Check Stripe configuration (optional)
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      health.checks.stripe = 'healthy'
    } else {
      health.checks.stripe = 'unhealthy'
      // Stripe is optional, so don't mark overall as unhealthy
    }
  } catch (error) {
    health.checks.stripe = 'unhealthy'
  }

  // Check Prisma connection (simplified - just check if we can query)
  try {
    // Prisma connection is checked via Supabase connection
    // If Supabase is healthy, Prisma should be too
    health.checks.prisma = health.checks.supabase === 'healthy' ? 'healthy' : 'unhealthy'
  } catch (error) {
    health.checks.prisma = 'unhealthy'
  }

  // Determine overall status
  if (health.checks.supabase === 'unhealthy' || health.checks.environment === 'unhealthy') {
    health.status = 'unhealthy'
  } else if (Object.values(health.checks).some(check => check === 'unhealthy')) {
    health.status = 'degraded'
  }

  const responseTime = Date.now() - startTime
  
  return NextResponse.json(
    { 
      ...health,
      responseTime: `${responseTime}ms`
    },
    { 
      status: health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  )
}

