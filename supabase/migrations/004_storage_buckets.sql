-- Create storage buckets and policies

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Posts bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- Listings bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('listings', 'listings', true)
ON CONFLICT (id) DO NOTHING;

-- Messages bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', false)
ON CONFLICT (id) DO NOTHING;

-- Vendor documents bucket (private - sensitive documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-docs', 'vendor-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Vendor assets bucket (public - banners, logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-assets', 'vendor-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Posts media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Listings media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload listing media" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update listing media" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete listing media" ON storage.objects;
DROP POLICY IF EXISTS "Messages attachments are accessible to participants" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Vendor docs are accessible to vendor and admins" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view vendor documents" ON storage.objects;

-- Storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for posts bucket
CREATE POLICY "Posts media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "Users can upload their own post media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own post media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own post media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for listings bucket
CREATE POLICY "Listings media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listings');

CREATE POLICY "Vendors can upload listing media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listings' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_vendor = TRUE OR vendor_verified = TRUE)
    )
  );

CREATE POLICY "Vendors can update listing media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'listings' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_vendor = TRUE OR vendor_verified = TRUE)
    )
  );

CREATE POLICY "Vendors can delete listing media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listings' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (is_vendor = TRUE OR vendor_verified = TRUE)
    )
  );

-- Storage policies for messages bucket (private)
CREATE POLICY "Messages attachments are accessible to participants"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'messages' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      (storage.foldername(name))[2] = auth.uid()::text
    )
  );

CREATE POLICY "Users can upload message attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'messages' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for vendor-docs bucket (private)
-- Only vendors can upload their own documents, only admins can read
CREATE POLICY "Vendor docs are accessible to vendor and admins"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-docs' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND (email LIKE '%@admin%' OR vendor_verified = true) -- Temporary admin check
      )
    )
  );

CREATE POLICY "Vendors can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-docs' AND
    (storage.foldername(name))[1] = auth.uid()::text AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_vendor = TRUE
    )
  );

CREATE POLICY "Admins can view vendor documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (email LIKE '%@admin%' OR vendor_verified = true) -- Temporary admin check
    )
  );

