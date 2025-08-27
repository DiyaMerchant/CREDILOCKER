-- Check if the field_project_approvals table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'field_project_approvals'
) as table_exists;

-- Check the structure of field_project_approvals table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'field_project_approvals'
ORDER BY ordinal_position;

-- Check for any existing approval records
SELECT COUNT(*) as total_approvals FROM field_project_approvals;

-- Check for any existing approvals for specific student/class combinations
SELECT student_uid, class, COUNT(*) as approval_count
FROM field_project_approvals
GROUP BY student_uid, class
HAVING COUNT(*) > 1;

-- Check the unique constraints on the table
SELECT conname, contype, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'field_project_approvals'::regclass;


