/**
 * Database Verification Script
 * Verifies that all database tables are properly set up and accessible
 * 
 * Usage: npx ts-node scripts/verify-db.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface Check {
  name: string
  fn: () => Promise<any>
}

async function verifyDatabase() {
  console.log('🔍 Verifying database setup...\n')
  console.log('=' .repeat(50))
  
  const checks: Check[] = [
    { 
      name: 'Profiles table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM profiles` 
    },
    { 
      name: 'Posts table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM posts` 
    },
    { 
      name: 'Listings table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM listings` 
    },
    { 
      name: 'Orders table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM orders` 
    },
    { 
      name: 'Badges table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM badges` 
    },
    { 
      name: 'Messages table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM messages` 
    },
    { 
      name: 'Notifications table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM notifications` 
    },
    { 
      name: 'News table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM news` 
    },
    { 
      name: 'Bookings table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM bookings` 
    },
    { 
      name: 'Groups table', 
      fn: () => prisma.$queryRaw`SELECT COUNT(*) FROM groups` 
    },
  ]

  let successCount = 0
  let failCount = 0

  for (const check of checks) {
    try {
      await check.fn()
      console.log(`✅ ${check.name.padEnd(30)} - OK`)
      successCount++
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ ${check.name.padEnd(30)} - FAILED`)
      console.error(`   Error: ${errorMessage}`)
      failCount++
    }
  }
  
  console.log('=' .repeat(50))
  console.log(`\n📊 Results: ${successCount} passed, ${failCount} failed`)
  
  await prisma.$disconnect()
  
  if (failCount > 0) {
    console.log('\n⚠️  Some database checks failed!')
    console.log('Please ensure:')
    console.log('  1. All Supabase migrations are applied')
    console.log('  2. DATABASE_URL is correctly configured in .env.local')
    console.log('  3. Prisma Client is generated: npm run prisma:generate')
    process.exit(1)
  } else {
    console.log('\n✅ Database verification complete - all tables accessible!')
  }
}

// Run verification
verifyDatabase().catch((error) => {
  console.error('Fatal error during verification:', error)
  process.exit(1)
})

