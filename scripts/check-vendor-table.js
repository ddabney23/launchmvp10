/**
 * Script to check if vendor_applications table exists in Supabase
 * and provide instructions to create it if missing
 */

const { createClient } = require('@supabase/supabase-js');
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

async function checkTable() {
  console.log('🔍 Checking if vendor_applications table exists...\n');

  try {
    // Try to query the table
    const { data, error } = await supabase
      .from('vendor_applications')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('❌ Table does NOT exist\n');
        console.log('📋 To create the table, run the migration:');
        console.log('   1. Go to Supabase Dashboard → SQL Editor');
        console.log('   2. Copy contents of: supabase/migrations/025_vendor_applications.sql');
        console.log('   3. Paste and run in SQL Editor\n');
        console.log('   Or use Supabase CLI:');
        console.log('   supabase db push\n');
        return false;
      } else {
        console.error('❌ Error checking table:', error.message);
        return false;
      }
    }

    console.log('✅ Table exists!');
    console.log(`   Found ${data?.length || 0} records\n`);
    
    // Check table structure
    const { data: columns, error: columnError } = await supabase.rpc('get_table_columns', {
      table_name: 'vendor_applications'
    }).catch(() => ({ data: null, error: null }));

    if (!columnError && columns) {
      console.log('📊 Table columns:', columns.map(c => c.column_name).join(', '));
    }

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

checkTable()
  .then((exists) => {
    if (exists) {
      console.log('✨ Everything looks good!');
      process.exit(0);
    } else {
      console.log('⚠️  Action required: Create the vendor_applications table');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

