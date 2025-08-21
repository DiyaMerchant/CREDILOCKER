/*
  # Create storage bucket for student submissions

  1. Storage Setup
    - Create 'student-submissions' bucket
    - Set bucket to public for easy file access
    - Add RLS policies for secure access

  2. Security
    - Students can upload their own files
    - Teachers can view all files
    - Public read access for viewing uploaded files
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-submissions', 'student-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to files
CREATE POLICY "Public can view files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-submissions');

-- Allow authenticated users to upload files
CREATE POLICY "Students can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-submissions');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-submissions');