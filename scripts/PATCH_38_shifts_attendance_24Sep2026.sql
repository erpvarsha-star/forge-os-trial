-- ============================================================================
-- PATCH_38 — shifts seed, late tracking, hours_worked, General shift assignment
-- 24 Sep 2026
-- ============================================================================
-- Run in Supabase SQL Editor (safe to re-run — all changes are idempotent).
-- ============================================================================

-- 1. Add late_grace_minutes to shifts (default 15 for rotating, 30 for General)
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS late_grace_minutes INTEGER NOT NULL DEFAULT 15;

-- 2. Add hours_worked to attendance_records (computed at check-out)
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(5,2);

-- 3. Update the 3 existing shifts with Yash-confirmed times + grace periods
UPDATE shifts SET start_time = '07:00', end_time = '15:30', late_grace_minutes = 15
  WHERE name = 'Shift 1';
UPDATE shifts SET start_time = '15:30', end_time = '00:00', late_grace_minutes = 15
  WHERE name = 'Shift 2';
UPDATE shifts SET start_time = '00:00', end_time = '07:00', late_grace_minutes = 15, is_night_shift = true
  WHERE name = 'Shift 3';

-- 4. Insert General, Security Day, Security Night (idempotent — skip if present)
INSERT INTO shifts (name, start_time, end_time, late_grace_minutes, is_night_shift)
SELECT 'General', '09:00', '18:00', 30, false
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'General');

INSERT INTO shifts (name, start_time, end_time, late_grace_minutes, is_night_shift)
SELECT 'Security Day', '07:00', '19:00', 15, false
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Security Day');

INSERT INTO shifts (name, start_time, end_time, late_grace_minutes, is_night_shift)
SELECT 'Security Night', '19:00', '07:00', 15, true
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Security Night');

-- 5. Auto-assign General shift to all active staff + consultants
--    (excluding security_guard and supervisor — those rotate and are assigned weekly by HR)
--    Covers 2026-09-24 through 2026-12-31, skipping Fridays (weekly off = DOW 5).
--    ON CONFLICT DO NOTHING — safe to re-run; does not overwrite any manual assignments.
INSERT INTO employee_shifts (employee_id, shift_id, date)
SELECT
  e.id,
  s.id,
  d::date
FROM
  generate_series('2026-09-24'::date, '2026-12-31'::date, '1 day'::interval) AS d,
  employees e
  CROSS JOIN (SELECT id FROM shifts WHERE name = 'General') s
WHERE
  e.category IN ('staff', 'consultant')
  AND e.role NOT IN ('supervisor', 'security_guard')
  AND e.is_active = true
  AND EXTRACT(DOW FROM d::date) != 5  -- skip Fridays (DOW 5)
ON CONFLICT (employee_id, date) DO NOTHING;

-- Sanity checks — run these after applying and confirm in the output:
-- SELECT name, start_time, end_time, late_grace_minutes FROM shifts ORDER BY start_time;
-- SELECT COUNT(*) FROM employee_shifts WHERE shift_id = (SELECT id FROM shifts WHERE name = 'General');
-- SELECT COUNT(*) FROM attendance_records WHERE hours_worked IS NOT NULL;
