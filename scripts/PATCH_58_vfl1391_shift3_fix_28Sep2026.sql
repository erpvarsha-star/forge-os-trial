-- PATCH_58: VFL1391's 00:05 IST check-in on 28 Sep 2026 belongs to Shift 3 on 28 Sep
-- 28 Sep 2026 — applied live, kept here as the record.
--
-- Yash: "if he checked in 12.05 am consider him as night shift."
-- Shift 3 = 00:00-07:00 (15 min grace), so a 00:05 check-in is Shift 3, on time,
-- on 28 Sep. The row had been written as date=2026-09-27 by a pre-IST-fix APK
-- (UTC date), and his 28 Sep employee_shifts row said General (09:00).

WITH emp AS (SELECT id FROM employees WHERE emp_code = 'VFL1391')
UPDATE attendance_records
SET date = '2026-09-28', status = 'P', late_minutes = NULL
WHERE employee_id = (SELECT id FROM emp)
  AND date = '2026-09-27'
  AND (check_in_time AT TIME ZONE 'Asia/Kolkata')::date = '2026-09-28'
  AND NOT EXISTS (SELECT 1 FROM attendance_records
                  WHERE employee_id = (SELECT id FROM emp) AND date = '2026-09-28');

UPDATE employee_shifts
SET shift_id = (SELECT id FROM shifts WHERE name = 'Shift 3')
WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1391')
  AND date = '2026-09-28';
