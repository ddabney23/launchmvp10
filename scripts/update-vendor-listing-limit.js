#!/usr/bin/env node

/**
 * Update vendor listing limit
 * Sets a vendor's listing limit to unlimited (-1)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateVendorListingLimit(clerkUserId) {
  console.log(`\n📝 Updating listing limit for Clerk user: ${clerkUserId}`);
  
  try {
    // 1. Get profile by Clerk ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, username, is_vendor')
      .eq('clerk_user_id', clerkUserId)
      .maybeSingle();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError.message);
      return;
    }

    if (!profile) {
      console.error('❌ Profile not found for Clerk ID:', clerkUserId);
      return;
    }

    console.log(`✅ Found profile:`, {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      is_vendor: profile.is_vendor
    });

    // 2. Check if vendor_profiles entry exists
    const { data: vendorProfile, error: vpError } = await supabase
      .from('vendor_profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle();

    if (vpError && vpError.code !== 'PGRST116') {
      console.error('❌ Error checking vendor_profiles:', vpError.message);
      return;
    }

    if (vendorProfile) {
      // Update existing vendor_profiles entry
      console.log('📝 Updating existing vendor_profiles entry...');
      const { error: updateError } = await supabase
        .from('vendor_profiles')
        .update({
          listing_limit: -1, // -1 means unlimited
          subscription_tier: 'premium',
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error('❌ Error updating vendor_profiles:', updateError.message);
        return;
      }

      console.log('✅ Updated vendor_profiles - listing limit set to unlimited');
    } else {
      // Create new vendor_profiles entry
      console.log('📝 Creating new vendor_profiles entry...');
      const { error: insertError } = await supabase
        .from('vendor_profiles')
        .insert({
          id: profile.id,
          listing_limit: -1, // -1 means unlimited
          subscription_tier: 'premium',
          subscription_status: 'active',
          transaction_fee_percent: 1.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Error creating vendor_profiles:', insertError.message);
        return;
      }

      console.log('✅ Created vendor_profiles - listing limit set to unlimited');
    }

    // 3. Ensure is_vendor is true in profiles table
    if (!profile.is_vendor) {
      console.log('📝 Updating is_vendor to true...');
      const { error: vendorError } = await supabase
        .from('profiles')
        .update({ is_vendor: true })
        .eq('id', profile.id);

      if (vendorError) {
        console.error('❌ Error updating is_vendor:', vendorError.message);
      } else {
        console.log('✅ Updated is_vendor to true');
      }
    }

    console.log('\n✅ Vendor listing limit updated successfully!');
    console.log('The vendor can now create unlimited listings.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get Clerk user ID from command line or use default
const clerkUserId = process.argv[2] || 'user_362rTlPKCxPkymHjRcQtosPabVY';

updateVendorListingLimit(clerkUserId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
