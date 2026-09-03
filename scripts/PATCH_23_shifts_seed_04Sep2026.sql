/**
 * PATCH_23_shifts_seed_04Sep2026.sql
 *
 * Seeds the shifts table with the three production shifts for Varsha Forgings.
 * The shifts table exists but is empty, so edge functions (shift-reminder,
 * nightly-scoring) cannot match employee_shifts against any real shifts.
 * This patch creates the three known shifts so employee_shifts can be
 * populated via HR's shifts.tsx assignment flow.
 *
 * The three shifts are:
 *   - Shift 1 (Morning): 08:30 - 15:30
 *   - Shift 2 (Evening): 15:30 - 23:30
 *   - Shift 3 (Night): 23:30 - 08:30 (next day, marked as night_shift=true)
 *
 * These match plant_config.form_shift_schedule, which is the canonical
 * shift-timing source for the app and edge functions (set via PATCH_14).
 */

insert into shifts (name, start_time, end_time, is_night_shift) values
  ('Shift 1', '08:30', '15:30', false),
  ('Shift 2', '15:30', '23:30', false),
  ('Shift 3', '23:30', '08:30', true)
on conflict do nothing;

-- Verify the insert
select 'Shifts seeded:' as status, count(*) as shift_count from shifts;
