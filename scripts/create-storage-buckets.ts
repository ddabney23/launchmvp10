import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const buckets = [
  {
    id: 'avatars',
    name: 'avatars',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  {
    id: 'images',
    name: 'images',
    public: true,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  },
  {
    id: 'videos',
    name: 'videos',
    public: true,
    fileSizeLimit: 52428800, // 50MB (Supabase free tier limit)
    allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime']
  },
  {
    id: 'documents',
    name: 'documents',
    public: false,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }
]

async function createStorageBuckets() {
  console.log('🚀 Creating Supabase storage buckets...\n')

  for (const bucket of buckets) {
    try {
      // Check if bucket exists
      const { data: existingBuckets } = await supabase.storage.listBuckets()
      const bucketExists = existingBuckets?.some(b => b.id === bucket.id)

      if (bucketExists) {
        console.log(`✓ Bucket "${bucket.id}" already exists`)
        continue
      }

      // Create bucket
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: bucket.fileSizeLimit,
        allowedMimeTypes: bucket.allowedMimeTypes
      })

      if (error) {
        console.error(`✗ Failed to create bucket "${bucket.id}":`, error.message)
      } else {
        console.log(`✓ Created bucket "${bucket.id}" (${bucket.public ? 'public' : 'private'}, max ${formatBytes(bucket.fileSizeLimit)})`)
      }
    } catch (error) {
      console.error(`✗ Error creating bucket "${bucket.id}":`, error)
    }
  }

  console.log('\n✅ Storage bucket setup complete!')
  console.log('\n📝 Next steps:')
  console.log('   1. Configure RLS policies in Supabase Dashboard → Storage')
  console.log('   2. Or run the SQL script: scripts/setup-storage-buckets.sql')
  console.log('   3. Test file uploads at: http://localhost:3000/onboarding\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(0) + ' MB'
  return (bytes / 1073741824).toFixed(0) + ' GB'
}

createStorageBuckets().catch(console.error)
