/**
 * Script to set admin status for a user
 * Run: node scripts/set-admin.js <email>
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setAdminStatus(email) {
  console.log(`\n🔍 Looking for user with email: ${email}`);

  // First, check Clerk users via profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message);
    return;
  }

  if (!profile) {
    console.error('❌ No profile found with that email');
    console.log('\n📋 All profiles in database:');
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('email, username, is_admin, clerk_user_id')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allProfiles && allProfiles.length > 0) {
      console.table(allProfiles);
    } else {
      console.log('No profiles found in database.');
    }
    return;
  }

  console.log('\n✅ Found profile:');
  console.log(`   Email: ${profile.email}`);
  console.log(`   Username: ${profile.username}`);
  console.log(`   Current admin status: ${profile.is_admin}`);
  console.log(`   Clerk User ID: ${profile.clerk_user_id}`);

  if (profile.is_admin) {
    console.log('\n✅ User is already an admin!');
    return;
  }

  console.log('\n🔧 Setting admin status to true...');

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', profile.id);

  if (updateError) {
    console.error('❌ Error updating profile:', updateError.message);
    return;
  }

  console.log('✅ Admin status updated successfully!');
  
  // Verify the update
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('email, username, is_admin')
    .eq('id', profile.id)
    .single();

  console.log('\n✅ Verified updated profile:');
  console.log(`   Email: ${updatedProfile.email}`);
  console.log(`   Username: ${updatedProfile.username}`);
  console.log(`   Admin status: ${updatedProfile.is_admin}`);
  console.log('\n🎉 Done! Please refresh your browser to see the Admin Dashboard link.');
}

// Get email from command line or use default
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node scripts/set-admin.js <email>');
  console.log('Example: node scripts/set-admin.js ddabney23@gmail.com');
  process.exit(1);
}

setAdminStatus(email)
  .catch(console.error)
  .finally(() => process.exit(0));
