-- PATCH_25: Seed payroll_records for Aug 2026 — active workers only.
-- Source: "VFL Worker Salary Slip Generator 2026" (Sep 19, 2026 revision).
-- Only the 19 active (TRUE) VFL4xxx workers have a completed Aug 2026 payslip.
-- net_pay = payable_salary (final take-home). Per-component breakdown (basic/hra/etc.)
--   is available in the salary sheet but not extracted yet — HR can add it later via
--   UPDATE statements or the app's future payroll-entry screen.
-- Staff (VFL1xxx, VFL5xxx): NOT seeded — no current salary sheet found in Drive.
--   Staff payslip screens will show "no record for this month" until HR provides the data.
-- Safe to re-run: INSERT ... ON CONFLICT (employee_id, month, year) DO NOTHING.

BEGIN;

INSERT INTO payroll_records (employee_id, month, year, net_pay)
VALUES
  ((SELECT id FROM employees WHERE emp_code = 'VFL4008'), '08', 2026, 36655),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4011'), '08', 2026, 40458),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4012'), '08', 2026, 30420),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4024'), '08', 2026, 37018),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4025'), '08', 2026, 48492),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4026'), '08', 2026, 47269),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4032'), '08', 2026, 29443),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4033'), '08', 2026, 38827),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4036'), '08', 2026, 42601),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4041'), '08', 2026, 39626),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4042'), '08', 2026, 39826),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4043'), '08', 2026, 41459),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4045'), '08', 2026, 36296),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4063'), '08', 2026, 43650),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4065'), '08', 2026, 35736),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4066'), '08', 2026, 29574),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4068'), '08', 2026, 38262),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4071'), '08', 2026, 25571),
  ((SELECT id FROM employees WHERE emp_code = 'VFL4072'), '08', 2026, 24555)
ON CONFLICT (employee_id, month, year) DO NOTHING;

-- Verify
SELECT COUNT(*) AS seeded_records FROM payroll_records WHERE year = 2026 AND month = '08';
SELECT e.emp_code, e.name, pr.net_pay
FROM payroll_records pr JOIN employees e ON e.id = pr.employee_id
WHERE pr.year = 2026 AND pr.month = '08'
ORDER BY e.emp_code;

COMMIT;
