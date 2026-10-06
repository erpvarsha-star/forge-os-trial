-- PATCH_81_kajal_general_pune_shift_fix_06Oct2026.sql
--
-- Real bug found while tracing Yash's "point 8" complaint for VFL1567
-- (Kajal Balkrishna Sutar) specifically. Not data loss -- her attendance
-- was being recorded every day, but against the WRONG shift: 85
-- `employee_shifts` rows, 24 Sep through 31 Dec 2026, all plain
-- 'General' (09:00 start), `assignment_source='hr_allocated'` --
-- presumably a bulk HR allocation sweep run before her Pune schedule
-- existed (PATCH_71, same day as this patch). Because an HR-allocated
-- row for a date always wins over `employees.default_shift_id` in
-- `resolveShiftForCheckIn()` (by design, for everyone else), her real
-- 10:00 "General (Pune)" shift never got a chance to apply -- she was
-- measured against a 09:00 start + 30min grace every single day,
-- showing "late" by 64-95 minutes for arriving exactly on time for her
-- actual shift.
--
-- Fixed:
-- 1. All her employee_shifts rows from 1 Oct 2026 (go-live) onward --
--    79 rows -- corrected from General to General (Pune). Pre-1-Oct
--    rows (test mode) deliberately left untouched per the locked
--    "do not retroactively re-evaluate pre-1-Oct attendance" rule.
-- 2. Her already-recorded attendance_records for 1/3/5/6 Oct recomputed
--    against General (Pune)'s real 10:00 start + 30min grace:
--    1 Oct (10:04) L->P, 3 Oct (10:35) L 95min->L 35min (she was 5min
--    over the 30min grace, not 95), 5 Oct (10:04) L->P, 6 Oct (10:16)
--    L->P. 2 Oct (Friday, her weekly-off day worked) was already P,
--    unaffected -- no employee_shifts row exists for a weekly-off day
--    worked ad hoc, so this bug never touched it.
--
-- Not fixed, flagged instead: nothing in the app currently stops a
-- bulk/master shift allocation from silently overwriting a
-- default_shift_id employee's special schedule -- she is the only
-- employee with default_shift_id set today, so this can only recur for
-- her specifically (if HR's shift screen bulk-allocates her again) until
-- a second such employee exists. Revisit only if it recurs or a second
-- default_shift_id employee is added.

update employee_shifts
set shift_id = '12f10c45-7ddb-4ad4-8e89-912d5f24a766'  -- General (Pune)
where employee_id = '603807a2-8184-4888-8c84-fc9f042d0cbe'  -- VFL1567 Kajal
  and shift_id = '6462ecce-ef5b-4adc-a1d6-b55ee1dfebae'  -- General
  and date >= '2026-10-01';

update attendance_records
set status = 'P', late_minutes = null
where employee_id = '603807a2-8184-4888-8c84-fc9f042d0cbe'
  and date in ('2026-10-01', '2026-10-05', '2026-10-06');

update attendance_records
set status = 'L', late_minutes = 35
where employee_id = '603807a2-8184-4888-8c84-fc9f042d0cbe'
  and date = '2026-10-03';

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- Confirmed live 6 Oct 2026: 79 employee_shifts rows corrected (1 Oct -
-- 31 Dec), attendance_records for 1/3/5/6 Oct recomputed correctly.
