-- ============================================================================
-- PATCH_23 — seed the three standard plant shifts
-- 31 Aug 2026
--
-- PROBLEM: shifts table has been empty since FINAL_SCHEMA was deployed.
--   employee_shifts has a NOT NULL FK on shift_id → shifts(id), so HR Admin's
--   shifts.tsx "Assign Shift" modal has never had anything to pick, making it
--   impossible to populate employee_shifts at all.
--   shift-reminder's daily_checkin_reminder mode joins employee_shifts to
--   shifts on start_time — with no rows it always returned notified:0.
--
-- FIX: insert the three real VFPL shift timings (from plant_config's
--   form_shift_schedule, confirmed live since PATCH_14).
--   Shift 3 crosses midnight → is_night_shift = true.
--   Idempotent: ON CONFLICT (name) DO NOTHING — safe to re-run.
--
-- AFTER RUNNING: HR Admin can immediately open the Shifts screen and assign
--   shifts to employees. shift-reminder's daily check-in reminder will also
--   start firing once employee_shifts has rows.
-- ============================================================================

-- Add a unique constraint on name so the ON CONFLICT clause works.
-- DO NOTHING if it already exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_name_key' AND conrelid = 'shifts'::regclass
  ) THEN
    ALTER TABLE shifts ADD CONSTRAINT shifts_name_key UNIQUE (name);
  END IF;
END
$$;

INSERT INTO shifts (name, start_time, end_time, is_night_shift)
VALUES
  ('Shift 1', '08:30', '15:30', false),
  ('Shift 2', '15:30', '23:30', false),
  ('Shift 3', '23:30', '08:30', true)
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT name, start_time, end_time, is_night_shift FROM shifts ORDER BY start_time;
-- Expected: 3 rows
