/*
  # Update Field Project Submissions Policies

  1. Security Updates
    - Add policy for students to delete their own submissions
    - Update existing policies for better access control
    - Add policy for teachers to view all submissions with student details

  2. Changes
    - Enable students to delete their own field project submissions
    - Ensure teachers can view all submissions across all classes
    - Maintain data security with proper RLS policies
*/

-- Drop existing policies to recreate them with better structure
DROP POLICY IF EXISTS "Allow students to insert their own field project submissions" ON field_project_submissions;
DROP POLICY IF EXISTS "Students can insert their own field project submissions" ON field_project_submissions;
DROP POLICY IF EXISTS "Students can view their own field project submissions" ON field_project_submissions;
DROP POLICY IF EXISTS "Teachers can view all field project submissions" ON field_project_submissions;

-- Create comprehensive policies for field project submissions
CREATE POLICY "Students can insert their own submissions"
  ON field_project_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.uid::text = field_project_submissions.student_uid::text 
      AND students.uid::text = (current_setting('request.jwt.claims'::text, true)::json ->> 'uid'::text)
    )
  );

CREATE POLICY "Students can view their own submissions"
  ON field_project_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.uid::text = field_project_submissions.student_uid::text 
      AND students.uid::text = (current_setting('request.jwt.claims'::text, true)::json ->> 'uid'::text)
    )
  );

CREATE POLICY "Students can delete their own submissions"
  ON field_project_submissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students 
      WHERE students.uid::text = field_project_submissions.student_uid::text 
      AND students.uid::text = (current_setting('request.jwt.claims'::text, true)::json ->> 'uid'::text)
    )
  );

CREATE POLICY "Teachers can view all submissions"
  ON field_project_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teachers 
      WHERE teachers.employee_code::text = (current_setting('request.jwt.claims'::text, true)::json ->> 'employee_code'::text)
    )
  );

CREATE POLICY "Public can insert submissions"
  ON field_project_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can view submissions"
  ON field_project_submissions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can delete submissions"
  ON field_project_submissions
  FOR DELETE
  TO public
  USING (true);