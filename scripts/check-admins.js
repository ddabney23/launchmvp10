/**
 * Script to check current admin users
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkAdmins() {
  console.log('\n📋 Checking all user profiles...\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, username, is_admin, is_vendor, vendor_verified, clerk_user_id, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('No profiles found.');
    return;
  }

  console.log(`Total profiles: ${profiles.length}\n`);

  // Show admins
  const admins = profiles.filter(p => p.is_admin);
  if (admins.length > 0) {
    console.log('👑 ADMIN USERS:');
    console.table(admins.map(a => ({
      Email: a.email,
      Username: a.username,
      'Clerk ID': a.clerk_user_id?.substring(0, 20) + '...',
    })));
  } else {
    console.log('❌ No admin users found!\n');
  }

  // Show all users
  console.log('\n👥 ALL USERS:');
  console.table(profiles.map(p => ({
    Email: p.email,
    Username: p.username,
    Admin: p.is_admin ? '✅' : '❌',
    Vendor: p.is_vendor ? '✅' : '❌',
    Verified: p.vendor_verified ? '✅' : '❌',
  })));

  console.log('\n💡 To make a user admin, run:');
  console.log('   node scripts/set-admin.js <email>\n');
}

checkAdmins()
  .catch(console.error)
  .finally(() => process.exit(0));
