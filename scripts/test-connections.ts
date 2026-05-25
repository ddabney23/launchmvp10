/**
 * Database Connection Test - Phase 1
 * 
 * Verifies Supabase and Prisma connections
 */

import 'dotenv/config'
import { createAdminClient } from '@/integrations/supabase/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  try {
    // Use admin client with service role to bypass RLS
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Test basic query
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (error) {
    console.error('❌ Supabase connection error:', error)
    return false
  }
}

async function testPrismaConnection() {
  console.log('🔍 Testing Prisma connection...')
  
  try {
    await prisma.$connect()
    
    // Test basic query
    const count = await prisma.profile.count()
    
    console.log(`✅ Prisma connection successful (${count} profiles)`)
    return true
  } catch (error) {
    console.error('❌ Prisma connection failed:', error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...')
  
  try {
    const { Redis } = await import('@upstash/redis')
    
    const redis = new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL']!,
      token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
    })
    
    // Test ping
    await redis.set('test:connection', 'ok', { ex: 10 })
    const result = await redis.get('test:connection')
    
    if (result === 'ok') {
      console.log('✅ Redis connection successful')
      return true
    }
    
    console.error('❌ Redis connection failed: unexpected response')
    return false
  } catch (error) {
    console.error('❌ Redis connection error:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting database connection tests...\n')
  
  const results = {
    supabase: await testSupabaseConnection(),
    prisma: await testPrismaConnection(),
    redis: await testRedisConnection(),
  }
  
  console.log('\n📊 Connection Test Results:')
  console.log('  Supabase:', results.supabase ? '✅ Pass' : '❌ Fail')
  console.log('  Prisma:', results.prisma ? '✅ Pass' : '❌ Fail')
  console.log('  Redis:', results.redis ? '✅ Pass' : '❌ Fail')
  
  const allPassed = Object.values(results).every(r => r)
  
  if (allPassed) {
    console.log('\n✅ All connection tests passed!')
    process.exit(0)
  } else {
    console.log('\n❌ Some connection tests failed. Check your environment variables.')
    process.exit(1)
  }
}

main()
