import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyPolicies() {
  console.log('🔐 Applying storage RLS policies...\n')

  const policies = [
    // Avatars - public view, owner upload/update/delete
    {
      bucket: 'avatars',
      name: 'Public avatars viewable',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "Public avatars are viewable by everyone"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
      `
    },
    {
      bucket: 'avatars',
      name: 'Users upload own avatar',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "Users can upload their own avatar"
        ON storage.objects FOR INSERT
        WITH CHECK (
          bucket_id = 'avatars' 
          AND auth.role() = 'authenticated'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
      `
    },
    {
      bucket: 'avatars',
      name: 'Users update own avatar',
      operation: 'UPDATE',
      sql: `
        CREATE POLICY "Users can update their own avatar"
        ON storage.objects FOR UPDATE
        USING (
          bucket_id = 'avatars' 
          AND auth.role() = 'authenticated'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
      `
    },
    {
      bucket: 'avatars',
      name: 'Users delete own avatar',
      operation: 'DELETE',
      sql: `
        CREATE POLICY "Users can delete their own avatar"
        ON storage.objects FOR DELETE
        USING (
          bucket_id = 'avatars' 
          AND auth.role() = 'authenticated'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
      `
    },
    // Images - similar to avatars
    {
      bucket: 'images',
      name: 'Public images viewable',
      operation: 'SELECT',
      sql: `
        CREATE POLICY "Public images are viewable by everyone"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'images');
      `
    },
    {
      bucket: 'images',
      name: 'Authenticated upload images',
      operation: 'INSERT',
      sql: `
        CREATE POLICY "Authenticated users can upload images"
        ON storage.objects FOR INSERT
        WITH CHECK (
          bucket_id = 'images' 
          AND auth.role() = 'authenticated'
        );
      `
    },
    {
      bucket: 'images',
      name: 'Users update own images',
      operation: 'UPDATE',
      sql: `
        CREATE POLICY "Users can update their own images"
        ON storage.objects FOR UPDATE
        USING (
          bucket_id = 'images' 
          AND auth.role() = 'authenticated'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
      `
    },
    {
      bucket: 'images',
      name: 'Users delete own images',
      operation: 'DELETE',
      sql: `
        CREATE POLICY "Users can delete their own images"
        ON storage.objects FOR DELETE
        USING (
          bucket_id = 'images' 
          AND auth.role() = 'authenticated'
          AND (storage.foldername(name))[1] = auth.uid()::text
        );
      `
    }
  ]

  for (const policy of policies) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql })
      
      if (error) {
        // Policy might already exist
        if (error.message.includes('already exists')) {
          console.log(`✓ Policy "${policy.name}" already exists`)
        } else {
          console.log(`⚠ ${policy.name}: ${error.message}`)
        }
      } else {
        console.log(`✓ Applied: ${policy.name}`)
      }
    } catch (err) {
      console.log(`⚠ ${policy.name}: Manual application needed`)
    }
  }

  console.log('\n📝 Note: Some policies may need manual application in Supabase Dashboard')
  console.log('   Go to: Dashboard → Storage → Policies')
  console.log('   Or run: scripts/setup-storage-buckets.sql in SQL Editor\n')
}

applyPolicies().catch(console.error)
