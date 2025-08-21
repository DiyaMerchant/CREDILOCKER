/*
  # Update CEP tables for enhanced functionality

  1. New Tables
    - Enhanced `cep_submissions` table with activity details
    - Updated `cep_requirements` table structure
  2. Security
    - Enable RLS on updated tables
    - Add policies for teachers and students
  3. Changes
    - Add activity tracking fields to cep_submissions
    - Update requirements table for better teacher management
*/

-- Drop existing tables to recreate with new structure
DROP TABLE IF EXISTS cep_submissions CASCADE;
DROP TABLE IF EXISTS cep_requirements CASCADE;

-- Create updated cep_requirements table
CREATE TABLE cep_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_employee_code varchar(50) REFERENCES teachers(employee_code),
  assigned_class varchar(10) NOT NULL CHECK (assigned_class IN ('FYIT', 'FYSD', 'SYIT', 'SYSD')),
  minimum_hours integer NOT NULL,
  deadline date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create enhanced cep_submissions table
CREATE TABLE cep_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uid varchar(50) REFERENCES students(uid),
  activity_name varchar(200) NOT NULL,
  hours integer NOT NULL,
  activity_date date NOT NULL,
  location varchar(200) NOT NULL,
  certificate_url text NOT NULL,
  picture_url text NOT NULL,
  geolocation text,
  submitted_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cep_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_submissions ENABLE ROW LEVEL SECURITY;

-- Policies for cep_requirements
CREATE POLICY "Teachers can manage requirements"
  ON cep_requirements
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM teachers 
    WHERE employee_code = ((current_setting('request.jwt.claims', true))::json ->> 'employee_code')
  ));

CREATE POLICY "Students can view requirements"
  ON cep_requirements
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM students 
    WHERE uid = ((current_setting('request.jwt.claims', true))::json ->> 'uid')
    AND class = assigned_class
  ));

-- Policies for cep_submissions
CREATE POLICY "Students can manage own submissions"
  ON cep_submissions
  FOR ALL
  TO authenticated
  USING (student_uid = ((current_setting('request.jwt.claims', true))::json ->> 'uid'));

CREATE POLICY "Teachers can view all submissions"
  ON cep_submissions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM teachers 
    WHERE employee_code = ((current_setting('request.jwt.claims', true))::json ->> 'employee_code')
  ));

-- Public policies for development
CREATE POLICY "Public can manage requirements" ON cep_requirements FOR ALL TO public USING (true);
CREATE POLICY "Public can manage submissions" ON cep_submissions FOR ALL TO public USING (true);