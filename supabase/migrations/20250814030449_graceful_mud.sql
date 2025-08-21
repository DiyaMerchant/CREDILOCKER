/*
  # Fix Storage Bucket Policies for File Uploads

  1. Storage Policies
    - Drop existing policies that may be conflicting
    - Create proper policies for authenticated file uploads
    - Allow public read access for viewing files
    - Allow authenticated users to upload files
    - Allow users to manage their own files

  2. Security
    - Proper RLS policies for storage operations
    - User-specific file access control
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Create comprehensive storage policies
CREATE POLICY "Public can view files in student-submissions"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'student-submissions');

CREATE POLICY "Authenticated users can upload to student-submissions"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'student-submissions');

CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'student-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);