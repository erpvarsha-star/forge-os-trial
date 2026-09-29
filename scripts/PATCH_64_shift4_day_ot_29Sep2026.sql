-- PATCH_64: Shift 4 (7am-7pm, 12h) -- day-shift companion to Shift 5
-- 29 Sep 2026
--
-- Yash originally proposed both when describing the OT pattern ("7am to
-- 7pm and 7pm to 7am, as shift 4 and shift 5"); confirmed he wants both
-- available now, not deferred. Same shape as Shift 5 (PATCH_63):
-- coexists with existing shifts, chosen week-by-week, visibility only
-- (no OT rupee split).
--
-- IMPORTANT: Shift 4's start_time (07:00) ties exactly with Shift 1's.
-- lib/shiftInference.ts's findClosestShift() was fixed in the same
-- commit as this patch to handle tied start_times safely (it previously
-- had a real bug where a tie would make one shift's window swallow the
-- entire 24-hour cycle) -- do not apply this patch without that fix
-- already deployed.

BEGIN;

INSERT INTO shifts (name, start_time, end_time, is_night_shift, late_grace_minutes, department)
SELECT 'Shift 4', '07:00', '19:00', false, 15, NULL
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Shift 4');

COMMIT;

-- Verify
SELECT name, start_time, end_time, is_night_shift, late_grace_minutes FROM shifts ORDER BY start_time, name;
