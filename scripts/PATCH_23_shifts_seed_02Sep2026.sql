-- PATCH_23_shifts_seed_02Sep2026.sql
-- Seeds the three standard shifts into the shifts table.
-- The shifts table has existed since FINAL_SCHEMA but was never seeded,
-- meaning employee_shifts cannot be populated (FK constraint) and
-- shift_reminder's daily_checkin_reminder has no start_time rows to match against.
-- Idempotent: ON CONFLICT DO NOTHING, safe to run any time.

INSERT INTO shifts (name, start_time, end_time, is_night_shift) VALUES
  ('Day',     '08:30', '15:30', false),
  ('Evening', '15:30', '23:30', false),
  ('Night',   '23:30', '08:30', true)
ON CONFLICT DO NOTHING;

-- Verify
SELECT name, start_time, end_time, is_night_shift FROM shifts ORDER BY start_time;
