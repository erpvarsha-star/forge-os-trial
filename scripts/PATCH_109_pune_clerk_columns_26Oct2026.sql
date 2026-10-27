-- PATCH_109 (RECORD ONLY - applied live 26 Oct 2026 by the owner's tool, never committed until now; do NOT re-run).
-- Column/index adds only. The functions pune_set_attendance and pune_attendance_roster
-- (109 / 109b) were superseded by their final versions in PATCH_110.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS attendance_clerk_location text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS uses_app boolean NOT NULL DEFAULT true;
UPDATE employees SET attendance_clerk_location='Pune' WHERE emp_code='VFL1567';
UPDATE employees SET uses_app=false WHERE emp_code LIKE 'BUNG%';
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_emp_date ON attendance_records(employee_id, date);
