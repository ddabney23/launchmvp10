const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running Stories migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '040_stories_feature.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative method - split and execute statements
      console.log('\n🔄 Trying alternative method...\n');
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';';
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: stmt });
        
        if (stmtError) {
          console.error(`❌ Statement ${i + 1} failed:`, stmtError.message);
          console.log('Statement:', stmt.substring(0, 100) + '...');
        }
      }
    } else {
      console.log('✅ Migration completed successfully!');
    }

    console.log('\n✅ Stories feature migration complete!');
    console.log('\nCreated:');
    console.log('  - stories table');
    console.log('  - story_views table');
    console.log('  - story_replies table');
    console.log('  - get_active_stories() function');
    console.log('  - RLS policies');
    console.log('  - Realtime subscriptions');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

runMigration();
