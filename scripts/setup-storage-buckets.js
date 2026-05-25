/**
 * Setup Script: Create Supabase Storage Buckets
 * 
 * This script creates the required storage buckets in Supabase.
 * Run this script once to set up your storage buckets.
 * 
 * Usage:
 *   node scripts/setup-storage-buckets.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease add these to your .env.local file');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Define buckets to create
const buckets = [
  {
    name: 'vendor-assets',
    public: true,
    description: 'Public assets for vendors (banners, logos)',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  {
    name: 'vendor-docs',
    public: false,
    description: 'Private vendor documents (business IDs, licenses)',
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
  },
  {
    name: 'listings',
    public: true,
    description: 'Product listing images',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  {
    name: 'avatars',
    public: true,
    description: 'User profile avatars',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  {
    name: 'posts',
    public: true,
    description: 'Post media (images, videos)',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
  }
];

async function createBucket(bucket) {
  try {
    // Check if bucket exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error(`❌ Error listing buckets:`, listError.message);
      return false;
    }

    const bucketExists = existingBuckets?.some(b => b.name === bucket.name);

    if (bucketExists) {
      console.log(`✅ Bucket "${bucket.name}" already exists`);
      return true;
    }

    // Create bucket
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      allowedMimeTypes: bucket.allowedMimeTypes,
      fileSizeLimit: 10485760 // 10MB
    });

    if (error) {
      console.error(`❌ Error creating bucket "${bucket.name}":`, error.message);
      return false;
    }

    console.log(`✅ Created bucket "${bucket.name}" (${bucket.public ? 'public' : 'private'})`);
    return true;
  } catch (error) {
    console.error(`❌ Unexpected error creating bucket "${bucket.name}":`, error);
    return false;
  }
}

async function setupBuckets() {
  console.log('🚀 Setting up Supabase Storage Buckets...\n');

  let successCount = 0;
  let failCount = 0;

  for (const bucket of buckets) {
    const success = await createBucket(bucket);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully created/verified: ${successCount} buckets`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} buckets`);
  }
  console.log('='.repeat(50));

  if (failCount === 0) {
    console.log('\n✨ All storage buckets are ready!');
    console.log('\nNext steps:');
    console.log('1. Go to Supabase Dashboard → Storage');
    console.log('2. Verify all buckets are created');
    console.log('3. Set up RLS policies if needed (buckets are created with default policies)');
  } else {
    console.log('\n⚠️  Some buckets failed to create. Please check the errors above.');
    console.log('You may need to create them manually in the Supabase Dashboard.');
    console.log('See STORAGE_SETUP.md for manual setup instructions.');
  }
}

// Run the setup
setupBuckets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

