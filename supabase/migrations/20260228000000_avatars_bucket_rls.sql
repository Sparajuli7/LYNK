-- ==========================================================================
-- Storage: avatars bucket and RLS for profile picture uploads
-- ==========================================================================
-- Profile edit uploads to avatars/{user_id}/{timestamp}.{ext}. Without
-- policies, INSERT fails with "new row violates row-level security policy".
-- ==========================================================================

-- Ensure avatars bucket exists and is public (getPublicUrl works)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing avatars-related storage policies to avoid duplicates
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname LIKE '%avatar%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Authenticated users can upload to their own folder: avatars/<user_id>/...
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can update (upsert) their own avatar files
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Public read so profile pictures load for everyone
CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Users can delete their own avatar files
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
