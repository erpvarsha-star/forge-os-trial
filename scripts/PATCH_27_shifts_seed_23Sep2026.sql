-- PATCH_27: Seed the three standard shifts.
-- NOTE: "Shift 1/2/3" rows were already seeded via PR #2 (Sep 2026).
-- This patch is a no-op if those rows exist; kept as a safety net / re-run guard.
-- start_time / end_time match plant_config.form_shift_schedule exactly,
-- which is what shift-reminder's daily_checkin_reminder mode reads.
-- department = NULL means the shift applies plant-wide (all departments).

INSERT INTO shifts (name, start_time, end_time, is_night_shift, department)
SELECT name, start_time, end_time, is_night_shift, department
FROM (VALUES
  ('Shift 1', '08:30', '15:30', false, NULL::text),
  ('Shift 2', '15:30', '23:30', false, NULL::text),
  ('Shift 3', '23:30', '08:30', true,  NULL::text)
) AS v(name, start_time, end_time, is_night_shift, department)
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = v.name);

-- Verify
SELECT name, start_time, end_time, is_night_shift FROM shifts ORDER BY name;
