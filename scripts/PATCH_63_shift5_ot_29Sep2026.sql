-- PATCH_63: Shift 5 (7pm-7am, 12h) for Shift-3 employees doing OT
-- 29 Sep 2026
--
-- Yash: some employees on Shift 3 (00:00-07:00) come in at 7pm for
-- overtime and work through to 7am -- the 7pm-12am portion is the OT
-- part. Decision (via AskUserQuestion): Shift 5 coexists with Shift 3,
-- chosen week-by-week by the allocator, not a permanent replacement.
-- Kept as its own row (not a re-use of the existing "Security Night"
-- 19:00-07:00 row) so security-specific reporting/logic keyed on that
-- name is untouched.
--
-- No OT rupee split built (Yash: no preference on how to split it) --
-- visibility only for now, matching this project's existing "Working
-- hours mapping (NOT salary)" precedent. See lib/workingHours.ts.

BEGIN;

INSERT INTO shifts (name, start_time, end_time, is_night_shift, late_grace_minutes, department)
SELECT 'Shift 5', '19:00', '07:00', true, 15, NULL
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Shift 5');

COMMIT;

-- Verify
SELECT name, start_time, end_time, is_night_shift, late_grace_minutes FROM shifts ORDER BY start_time;
