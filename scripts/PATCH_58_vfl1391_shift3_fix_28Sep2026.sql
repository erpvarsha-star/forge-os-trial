-- PATCH_58: VFL1391's 00:05 IST check-in on 28 Sep 2026 is Shift 3 OF 27 SEP
-- 28 Sep 2026 — applied live, kept here as the record.
--
-- Yash: "if he checked in 12.05 am consider him as night shift" … "it is 3rd
-- shift for 27th not 28th." Shift 3 (00:00-07:00) belongs to the previous
-- working day. The attendance row already carried date=2026-09-27 (a first
-- correction wrongly moved it to 28 Sep; this is the final state). His 27 Sep
-- shift was General (09:00) — set to Shift 3; his 28 Sep shift stays General.

UPDATE attendance_records
SET date = '2026-09-27', status = 'P', late_minutes = NULL
WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1391')
  AND (check_in_time AT TIME ZONE 'Asia/Kolkata') = '2026-09-28 00:05:12.273';

UPDATE employee_shifts
SET shift_id = (SELECT id FROM shifts WHERE name = 'Shift 3')
WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1391')
  AND date = '2026-09-27';

UPDATE employee_shifts
SET shift_id = (SELECT id FROM shifts WHERE name = 'General')
WHERE employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1391')
  AND date = '2026-09-28';
