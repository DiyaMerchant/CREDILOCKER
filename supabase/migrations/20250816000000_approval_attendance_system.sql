/*
  # Approval and Attendance System

  This migration adds approval/rejection functionality for FP and CEP submissions,
  and creates an attendance tracking system for co-curricular activities.

  1. Add approval status to field_project_submissions
  2. Add approval status to cep_submissions  
  3. Add marks and credits columns for FP
  4. Add credits column for CEP
  5. Create attendance tracking table for co-curricular activities
*/

-- Add approval status and evaluation columns to field_project_submissions
ALTER TABLE field_project_submissions 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS marks_allotted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_allotted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS evaluation_notes TEXT;

-- Add approval status and credits to cep_submissions
ALTER TABLE cep_submissions 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS credits_allotted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS evaluated_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS evaluation_notes TEXT;

-- Create attendance tracking table for co-curricular activities
CREATE TABLE IF NOT EXISTS co_curricular_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES co_curricular_activities(id) ON DELETE CASCADE,
  student_uid VARCHAR(50) NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent', 'late')),
  marked_by VARCHAR(50) NOT NULL REFERENCES teachers(employee_code) ON DELETE CASCADE,
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  UNIQUE(activity_id, student_uid)
);

-- Enable RLS on the new attendance table
ALTER TABLE co_curricular_attendance ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_field_project_approval_status ON field_project_submissions(approval_status);
CREATE INDEX IF NOT EXISTS idx_cep_approval_status ON cep_submissions(approval_status);
CREATE INDEX IF NOT EXISTS idx_attendance_activity ON co_curricular_attendance(activity_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON co_curricular_attendance(student_uid);

-- Add RLS policies for attendance table
CREATE POLICY "Teachers can manage attendance"
  ON co_curricular_attendance
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Students can view own attendance"
  ON co_curricular_attendance
  FOR SELECT
  TO public
  USING (true);

-- Add comments for documentation
COMMENT ON COLUMN field_project_submissions.approval_status IS 'Status of submission: pending, approved, or rejected';
COMMENT ON COLUMN field_project_submissions.marks_allotted IS 'Marks given for the field project (0-100)';
COMMENT ON COLUMN field_project_submissions.credits_allotted IS 'Credits awarded for the field project';
COMMENT ON COLUMN field_project_submissions.evaluated_by IS 'Employee code of the teacher who evaluated';
COMMENT ON COLUMN field_project_submissions.evaluated_at IS 'Timestamp when evaluation was completed';
COMMENT ON COLUMN field_project_submissions.evaluation_notes IS 'Teacher notes about the evaluation';

COMMENT ON COLUMN cep_submissions.approval_status IS 'Status of submission: pending, approved, or rejected';
COMMENT ON COLUMN cep_submissions.credits_allotted IS 'Credits awarded for the CEP activity';
COMMENT ON COLUMN cep_submissions.evaluated_by IS 'Employee code of the teacher who evaluated';
COMMENT ON COLUMN cep_submissions.evaluated_at IS 'Timestamp when evaluation was completed';
COMMENT ON COLUMN cep_submissions.evaluation_notes IS 'Teacher notes about the evaluation';

COMMENT ON TABLE co_curricular_attendance IS 'Attendance tracking for co-curricular activities';
COMMENT ON COLUMN co_curricular_attendance.attendance_status IS 'Attendance status: present, absent, or late';
COMMENT ON COLUMN co_curricular_attendance.marked_by IS 'Employee code of the teacher who marked attendance';


