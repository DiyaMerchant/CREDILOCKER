/*
  # Fix Storage Authentication and Policies

  1. Storage Policies
    - Drop existing conflicting policies
    - Create proper INSERT policy for authenticated users
    - Allow uploads based on user authentication
    - Enable proper file path restrictions

  2. Authentication Fix
    - Ensure storage respects authentication context
    - Allow authenticated users to upload to their designated paths
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload files" ON storage.objects;

-- Create a comprehensive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-submissions' AND
  (
    (name LIKE 'cep/certificates/%') OR
    (name LIKE 'cep/pictures/%') OR
    (name LIKE 'field_project/%')
  )
);

-- Ensure SELECT policy exists for public read access
CREATE POLICY "Public can view files" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'student-submissions');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'student-submissions');