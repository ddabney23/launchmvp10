/**
 * Script to create Supabase storage buckets
 * Run: node scripts/create-storage-buckets.js
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

const buckets = [
  { name: 'vendor-assets', public: true, description: 'Vendor banners and logos' },
  { name: 'vendor-docs', public: false, description: 'Vendor verification documents' },
  { name: 'listings', public: true, description: 'Product/listing images' },
  { name: 'avatars', public: true, description: 'User profile pictures' },
  { name: 'posts', public: true, description: 'Post media (images, videos)' },
  { name: 'stories', public: true, description: 'Story media' },
];

async function createBuckets() {
  console.log('\n📦 Creating Supabase storage buckets...\n');

  // List existing buckets
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Error listing buckets:', listError.message);
    process.exit(1);
  }

  const existingNames = existing.map(b => b.name);
  console.log(`✅ Found ${existingNames.length} existing buckets:`, existingNames.join(', ') || 'none');
  console.log('');

  for (const bucket of buckets) {
    if (existingNames.includes(bucket.name)) {
      console.log(`⏭️  Bucket "${bucket.name}" already exists`);
      continue;
    }

    console.log(`📦 Creating bucket: ${bucket.name} (${bucket.public ? 'public' : 'private'})...`);
    
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.name === 'stories' ? 52428800 : 10485760, // 50MB for stories, 10MB for others
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'application/pdf',
      ],
    });

    if (error) {
      console.error(`❌ Error creating bucket "${bucket.name}":`, error.message);
      continue;
    }

    console.log(`✅ Created bucket: ${bucket.name}`);
  }

  console.log('\n✅ Done! All buckets are ready.\n');
  
  // Verify all buckets exist
  const { data: finalBuckets } = await supabase.storage.listBuckets();
  console.log('📋 Final bucket list:');
  console.table(finalBuckets.map(b => ({
    Name: b.name,
    Public: b.public ? '✅' : '❌',
    'Created At': new Date(b.created_at).toLocaleString(),
  })));
}

createBuckets()
  .catch(console.error)
  .finally(() => process.exit(0));
