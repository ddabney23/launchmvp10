import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyStoragePolicies() {
  console.log('🔐 Applying storage RLS policies...\n')

  const sqlPath = path.join(__dirname, 'setup-storage-buckets.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('❌ Error applying policies:', error.message)
      console.log('\n⚠️  Please run the SQL manually in Supabase Dashboard → SQL Editor')
      console.log('   File: scripts/setup-storage-buckets.sql\n')
    } else {
      console.log('✅ Storage policies applied successfully!\n')
    }
  } catch (error) {
    console.log('⚠️  Direct SQL execution not available')
    console.log('   Please run scripts/setup-storage-buckets.sql in Supabase Dashboard → SQL Editor\n')
  }
}

applyStoragePolicies().catch(console.error)
