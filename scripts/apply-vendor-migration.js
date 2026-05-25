/**
 * Script to apply vendor_applications table migration
 * This will create the table if it doesn't exist
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚀 Applying vendor_applications table migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '025_vendor_applications.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement }).catch(async () => {
          // If exec_sql doesn't exist, try direct query (this won't work for DDL, but we'll try)
          return { error: { message: 'Cannot execute DDL via client. Please use Supabase Dashboard.' } };
        });

        if (error && !error.message.includes('already exists') && !error.message.includes('IF NOT EXISTS')) {
          console.warn(`   ⚠️  Warning: ${error.message}`);
        } else {
          console.log(`   ✅ Statement ${i + 1} executed`);
        }
      } catch (err) {
        console.warn(`   ⚠️  Could not execute statement ${i + 1}: ${err.message}`);
      }
    }

    console.log('\n⚠️  Note: This script cannot execute DDL statements directly.');
    console.log('   Please apply the migration using one of these methods:\n');
    console.log('   1. Supabase Dashboard:');
    console.log('      - Go to SQL Editor');
    console.log('      - Copy contents of: supabase/migrations/025_vendor_applications.sql');
    console.log('      - Paste and run\n');
    console.log('   2. Supabase CLI:');
    console.log('      supabase db push\n');

    // Verify table exists
    const { data, error } = await supabase
      .from('vendor_applications')
      .select('id')
      .limit(1);

    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      console.log('❌ Table still does not exist. Please apply migration manually.\n');
      process.exit(1);
    } else {
      console.log('✅ Table exists! Migration successful.\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    console.log('\n📋 Please apply the migration manually:');
    console.log('   1. Go to Supabase Dashboard → SQL Editor');
    console.log('   2. Copy contents of: supabase/migrations/025_vendor_applications.sql');
    console.log('   3. Paste and run\n');
    process.exit(1);
  }
}

applyMigration();

