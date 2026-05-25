-- Add stories storage bucket for story media uploads

-- Create stories bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stories',
  'stories',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];

-- Storage policies for stories bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Stories media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own story media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own story media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own story media" ON storage.objects;

-- Stories media is publicly accessible (for viewing)
CREATE POLICY "Stories media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stories');

-- Users can upload their own story media
-- Note: With Clerk, we use clerk_user_id in the path, not auth.uid()
-- The API route handles authentication and path construction
CREATE POLICY "Users can upload their own story media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stories');

-- Users can update their own story media
CREATE POLICY "Users can update their own story media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'stories');

-- Users can delete their own story media
CREATE POLICY "Users can delete their own story media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'stories');

