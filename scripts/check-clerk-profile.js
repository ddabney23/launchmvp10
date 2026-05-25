/**
 * Script to check profile by Clerk ID
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

async function checkClerkProfile(clerkId) {
  console.log(`\n🔍 Looking for profile with Clerk ID: ${clerkId}`);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', clerkId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!profile) {
    console.error('❌ No profile found with that Clerk ID');
    console.log('\n📋 Checking all profiles...');
    
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, email, username, clerk_user_id, is_admin')
      .order('created_at', { ascending: false });
    
    if (allProfiles && allProfiles.length > 0) {
      console.table(allProfiles);
    }
    
    console.log('\n💡 Creating profile for Clerk user...');
    
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        clerk_user_id: clerkId,
        email: 'ddabney23@gmail.com',
        username: 'optimixadmin',
        display_name: 'Demontre Dabney',
        is_admin: true,
        onboarding_completed: true,
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating profile:', createError.message);
      return;
    }
    
    console.log('✅ Profile created successfully!');
    console.table([newProfile]);
    return;
  }

  console.log('\n✅ Found profile:');
  console.table([{
    ID: profile.id,
    Email: profile.email,
    Username: profile.username,
    'Clerk ID': profile.clerk_user_id,
    Admin: profile.is_admin ? '✅' : '❌',
    'Onboarding Complete': profile.onboarding_completed ? '✅' : '❌',
  }]);

  if (!profile.is_admin) {
    console.log('\n🔧 Setting admin status...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', profile.id);
    
    if (updateError) {
      console.error('❌ Error updating:', updateError.message);
      return;
    }
    
    console.log('✅ Admin status updated!');
  }
}

const clerkId = process.argv[2] || 'user_35REqBwCK0OWulDHjBgeaPdfBnO';

checkClerkProfile(clerkId)
  .catch(console.error)
  .finally(() => process.exit(0));
