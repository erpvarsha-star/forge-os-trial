-- ============================================================================
-- PATCH_23_pune_and_shifts_07Sep2026.sql
--
-- Two unrelated gaps, combined into one file for a single run:
--
-- Part A — Pune office in the multi-point geofence.
--   Yash's coordinates: 18°33'25.0"N 73°48'58.9"E = 18.556944, 73.816361.
--   Radius 200 m (larger than the Aurangabad campus points — the Pune
--   office building is smaller, but GPS accuracy on a phone inside is worse).
--   worker/home.tsx and fraud-detector already read plant_locations and
--   fall back to the single-point plant_config only when the table is empty,
--   so check-in from Pune will succeed immediately after this runs.
--   Prerequisite: COMBINED_DEPLOY_21to22_13Aug2026.sql must have been run
--   first (creates the plant_locations table).
--
-- Part B — Seed the three real shifts into the `shifts` table.
--   shifts has no seed data anywhere in scripts/*.sql, and employee_shifts
--   has a NOT NULL FK to shifts(id), so HR can never assign any shift and
--   daily_checkin_reminder always returns notified:0 until these rows exist.
--   Times match plant_config.form_shift_schedule (seeded by PATCH_14):
--     S1 08:30–15:30, S2 15:30–23:30 (day), S3 23:30–08:30 (night).
--   Uses ON CONFLICT DO NOTHING so it's safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Part A: Pune office
-- ---------------------------------------------------------------------------
insert into plant_locations (name, latitude, longitude, radius_meters)
values ('Pune Office', 18.556944, 73.816361, 200)
on conflict (name) do update set
  latitude      = excluded.latitude,
  longitude     = excluded.longitude,
  radius_meters = excluded.radius_meters;

-- Verify
select name, latitude, longitude, radius_meters, is_active
  from plant_locations
 order by name;

-- ---------------------------------------------------------------------------
-- Part B: Shifts seed (S1 / S2 / S3)
-- ---------------------------------------------------------------------------
insert into shifts (name, start_time, end_time, is_night_shift) values
  ('Shift 1', '08:30', '15:30', false),
  ('Shift 2', '15:30', '23:30', false),
  ('Shift 3', '23:30', '08:30', true)
on conflict do nothing;

-- Verify
select id, name, start_time, end_time, break_minutes from shifts order by start_time;
