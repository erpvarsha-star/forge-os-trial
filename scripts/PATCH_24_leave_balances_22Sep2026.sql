-- PATCH_24: Seed leave_balances for all 129 active employees.
-- Workers (VFL4xxx): real EL/CL/SL Available values from "VFL Worker Salary Slip Generator 2026" (Sep 2026).
-- Staff (VFL1xxx, VFL5xxx) and inactive workers: 0/0/0 placeholder — HR (Pallavi) must update once
--   the staff leave balance sheet is provided.
-- Safe to re-run: only inserts rows that don't already exist, then updates real worker values.

BEGIN;

-- Step 1: Seed 0/0/0 for every employee that doesn't yet have a leave_balances row.
INSERT INTO leave_balances (employee_id, earned_leave, casual_leave, sick_leave)
SELECT e.id, 0, 0, 0
FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances lb WHERE lb.employee_id = e.id
);

-- Step 2: Update the 19 active VFL4xxx workers with their real Aug 2026 EL/CL/SL Available values.
UPDATE leave_balances SET earned_leave = 12, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4008');
UPDATE leave_balances SET earned_leave = 6,  casual_leave = 0, sick_leave = 1
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4011');
UPDATE leave_balances SET earned_leave = 14, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4012');
UPDATE leave_balances SET earned_leave = 0,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4024');
UPDATE leave_balances SET earned_leave = 9,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4025');
UPDATE leave_balances SET earned_leave = 3,  casual_leave = 2, sick_leave = 1
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4026');
UPDATE leave_balances SET earned_leave = 13, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4032');
UPDATE leave_balances SET earned_leave = 1,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4033');
UPDATE leave_balances SET earned_leave = 12, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4036');
UPDATE leave_balances SET earned_leave = 13, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4041');
UPDATE leave_balances SET earned_leave = 16, casual_leave = 1, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4042');
UPDATE leave_balances SET earned_leave = 9,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4043');
UPDATE leave_balances SET earned_leave = 13, casual_leave = 0, sick_leave = 1
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4045');
UPDATE leave_balances SET earned_leave = 20, casual_leave = 0, sick_leave = 1
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4063');
UPDATE leave_balances SET earned_leave = 8,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4065');
UPDATE leave_balances SET earned_leave = 19, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4066');
UPDATE leave_balances SET earned_leave = 8,  casual_leave = 0, sick_leave = 2
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4068');
UPDATE leave_balances SET earned_leave = 10, casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4071');
UPDATE leave_balances SET earned_leave = 4,  casual_leave = 0, sick_leave = 0
  WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4072');

-- Verify
SELECT COUNT(*) AS total_rows FROM leave_balances;
SELECT emp_code, earned_leave, casual_leave, sick_leave
FROM leave_balances lb JOIN employees e ON e.id = lb.employee_id
WHERE e.emp_code LIKE 'VFL4%' AND (earned_leave > 0 OR casual_leave > 0 OR sick_leave > 0)
ORDER BY e.emp_code;

COMMIT;
