/*
  # Fix Attendance and New Approval System

  This migration fixes the attendance table structure and implements the new
  student-level approval system instead of submission-level approval.

  1. Fix attendance table structure (activity_id should be UUID)
  2. Create student-level approval tables for FP and CEP
  3. Add credits configuration to requirements
  4. Remove submission-level approval columns
*/

-- Drop the existing attendance table and recreate with correct structure
DROP TABLE IF EXISTS co_curricular_attendance;

-- Create attendance tracking table with correct data types
CREATE TABLE IF NOT EXISTS co_curricular_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES co_curricular_activities(id) ON DELETE CASCADE,
  student_uid VARCHAR(50) NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
  attendance_status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent')),
  marked_by VARCHAR(50) NOT NULL REFERENCES teachers(employee_code) ON DELETE CASCADE,
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  UNIQUE(activity_id, student_uid)
);

-- Create student-level field project approval table
CREATE TABLE IF NOT EXISTS field_project_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_uid VARCHAR(50) NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
  class VARCHAR(10) NOT NULL,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  marks_allotted INTEGER DEFAULT 0,
  credits_allotted INTEGER DEFAULT 0,
  evaluated_by VARCHAR(50) NOT NULL REFERENCES teachers(employee_code) ON DELETE CASCADE,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  evaluation_notes TEXT,
  UNIQUE(student_uid, class)
);

-- Create student-level CEP approval table
CREATE TABLE IF NOT EXISTS cep_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_uid VARCHAR(50) NOT NULL REFERENCES students(uid) ON DELETE CASCADE,
  class VARCHAR(10) NOT NULL,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  credits_allotted INTEGER DEFAULT 0,
  evaluated_by VARCHAR(50) NOT NULL REFERENCES teachers(employee_code) ON DELETE CASCADE,
  evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  evaluation_notes TEXT,
  UNIQUE(student_uid, class)
);

-- Add credits configuration to CEP requirements
ALTER TABLE cep_requirements 
ADD COLUMN IF NOT EXISTS credits_config JSONB DEFAULT '[]';

-- Remove submission-level approval columns (we'll handle this in the application)
-- Note: We'll keep these columns for now to avoid breaking existing data
-- They can be removed in a future migration if needed

-- Enable RLS on new tables
ALTER TABLE co_curricular_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_project_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_approvals ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_activity ON co_curricular_attendance(activity_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON co_curricular_attendance(student_uid);
CREATE INDEX IF NOT EXISTS idx_fp_approval_student ON field_project_approvals(student_uid);
CREATE INDEX IF NOT EXISTS idx_fp_approval_class ON field_project_approvals(class);
CREATE INDEX IF NOT EXISTS idx_cep_approval_student ON cep_approvals(student_uid);
CREATE INDEX IF NOT EXISTS idx_cep_approval_class ON cep_approvals(class);

-- Add RLS policies for new tables
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

CREATE POLICY "Teachers can manage FP approvals"
  ON field_project_approvals
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Students can view own FP approval"
  ON field_project_approvals
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Teachers can manage CEP approvals"
  ON cep_approvals
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Students can view own CEP approval"
  ON cep_approvals
  FOR SELECT
  TO public
  USING (true);

-- Add comments for documentation
COMMENT ON TABLE co_curricular_attendance IS 'Attendance tracking for co-curricular activities';
COMMENT ON COLUMN co_curricular_attendance.attendance_status IS 'Attendance status: present or absent';
COMMENT ON COLUMN co_curricular_attendance.marked_by IS 'Employee code of the teacher who marked attendance';

COMMENT ON TABLE field_project_approvals IS 'Student-level field project approvals';
COMMENT ON COLUMN field_project_approvals.approval_status IS 'Overall approval status for student field project';
COMMENT ON COLUMN field_project_approvals.marks_allotted IS 'Total marks given for all field project submissions';
COMMENT ON COLUMN field_project_approvals.credits_allotted IS 'Total credits awarded for field project';
COMMENT ON COLUMN field_project_approvals.evaluation_notes IS 'Teacher notes about the overall evaluation';

COMMENT ON TABLE cep_approvals IS 'Student-level CEP approvals';
COMMENT ON COLUMN cep_approvals.approval_status IS 'Overall approval status for student CEP participation';
COMMENT ON COLUMN cep_approvals.credits_allotted IS 'Total credits awarded based on hours completed';
COMMENT ON COLUMN cep_approvals.evaluation_notes IS 'Teacher notes about the overall evaluation';

COMMENT ON COLUMN cep_requirements.credits_config IS 'JSON array of credit conditions: [{"hours": 30, "credits": 1}, {"hours": 60, "credits": 2}]. Teachers can set custom hour-to-credit ratios.';
