-- PATCH_24: Seed leave_balances for all active employees.
--
-- Sources (Sep 2026):
--   Staff (VFL1xxx/VFL5xxx) + Workers (VFL4xxx):
--     "VFL Leave Application 2026" Google Sheet — columns EL/CL/SL Available.
--     "Sep26 Available" rows = actual remaining balance as of Sep 2026.
--     "2026 Alloc" rows = initial 2026 allocation (actual may be lower if leaves taken).
--     "2025 Yr-End Bal" rows = last known balance; 2026 data absent (possible departure).
--   19 Active workers (VFL4042/43/45/63/65/66/68/71/72):
--     Salary slip generator (Sep 2026 revision) — EL Available is actual remaining.
--     Used in preference to the leave sheet's "2026 Alloc" initial allocation.
--
-- Employees NOT in either sheet (PATCH_08/09 new hires: VFL5452-62, etc.):
--   Seeded 0/0/0 by the INSERT step; HR to update.
--
-- Safe to re-run: INSERT only adds rows not already present; UPDATEs are idempotent.
-- VFL1441 (Jitendrasingh) shows negative balance (EL=-11, CL=-5, SL=-2) — correct,
--   reflects excess leaves taken in 2026; HR is aware.

BEGIN;

-- Step 1: Seed 0/0/0 for every employee that doesn't yet have a leave_balances row for 2026.
INSERT INTO leave_balances (employee_id, year, earned_leave, casual_leave, sick_leave)
SELECT e.id, 2026, 0, 0, 0
FROM employees e
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances lb WHERE lb.employee_id = e.id AND lb.year = 2026
);

-- ============================================================================
-- Step 2: Update real values — VFL1xxx STAFF (Sep26 Available where available,
--   2026 Alloc otherwise)
-- ============================================================================
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1001');
UPDATE leave_balances SET earned_leave = 16,  casual_leave = 1,   sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1064');
UPDATE leave_balances SET earned_leave = 10,  casual_leave = 3,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1066');
UPDATE leave_balances SET earned_leave = 0,   casual_leave = 0,   sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1272');
UPDATE leave_balances SET earned_leave = 10,  casual_leave = 5,   sick_leave = 3
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1290');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 2,   sick_leave = 2.5
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1319');
UPDATE leave_balances SET earned_leave = 16,  casual_leave = 3,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1327');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 0,   sick_leave = 3
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1386');
UPDATE leave_balances SET earned_leave = 11,  casual_leave = 2,   sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1389');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 0.5, sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1391');
UPDATE leave_balances SET earned_leave = -11, casual_leave = -5,  sick_leave = -2
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1441');
UPDATE leave_balances SET earned_leave = 0,   casual_leave = 0,   sick_leave = 0.5
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1446');
UPDATE leave_balances SET earned_leave = 5,   casual_leave = 3,   sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1450');
UPDATE leave_balances SET earned_leave = 4,   casual_leave = 0,   sick_leave = 2
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1453');
UPDATE leave_balances SET earned_leave = 1,   casual_leave = 0,   sick_leave = 0.5
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1463');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1465');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1482');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1516');
UPDATE leave_balances SET earned_leave = 14,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1520');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1527');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1528');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1543');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1545');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1549');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1550');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1553');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1556');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1557');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1562');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1564');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1566');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1567');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1568');

-- ============================================================================
-- Step 3: VFL5xxx STAFF (2026 Alloc)
-- ============================================================================
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5074');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5079');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5083');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5203');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5237');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5272');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5273');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5302');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5303');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5318');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5321');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5322');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5323');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5324');
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5337');
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5347');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5354');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5379');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5382');
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5383');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5397');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5398');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5399');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5400');
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5405');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5409');
UPDATE leave_balances SET earned_leave = 15,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5410');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5413');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5415');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5420');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5425');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5428');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5429');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5430');
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5433');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5434');
UPDATE leave_balances SET earned_leave = 16,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5439');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5440');
UPDATE leave_balances SET earned_leave = 10,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5442');
UPDATE leave_balances SET earned_leave = 12,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5444');
UPDATE leave_balances SET earned_leave = 10,  casual_leave = 5,   sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5445');

-- ============================================================================
-- Step 4: VFL4xxx WORKERS — Sep26 Available (actual remaining)
-- ============================================================================
UPDATE leave_balances SET earned_leave = 17,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4002');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4004');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4006');
UPDATE leave_balances SET earned_leave = 14,  casual_leave = -0.5, sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4007');
UPDATE leave_balances SET earned_leave = 12,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4008');
UPDATE leave_balances SET earned_leave = 6,   casual_leave = 0,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4011');
UPDATE leave_balances SET earned_leave = 14,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4012');
UPDATE leave_balances SET earned_leave = 0,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4024');
UPDATE leave_balances SET earned_leave = 9,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4025');
UPDATE leave_balances SET earned_leave = 3,   casual_leave = 2,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4026');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4030');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4032');
UPDATE leave_balances SET earned_leave = 1,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4033');
UPDATE leave_balances SET earned_leave = 12,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4036');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4041');

-- VFL4xxx — salary slip actual remaining (Aug 2026), more accurate than 2026 Alloc
UPDATE leave_balances SET earned_leave = 16,  casual_leave = 1,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4042');
UPDATE leave_balances SET earned_leave = 9,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4043');
UPDATE leave_balances SET earned_leave = 13,  casual_leave = 0,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4045');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 0,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4063');
UPDATE leave_balances SET earned_leave = 8,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4065');
UPDATE leave_balances SET earned_leave = 19,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4066');
UPDATE leave_balances SET earned_leave = 8,   casual_leave = 0,    sick_leave = 2
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4068');
UPDATE leave_balances SET earned_leave = 10,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4071');
UPDATE leave_balances SET earned_leave = 4,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4072');

-- VFL4xxx — 2026 Alloc (no salary slip data for these)
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 5,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4048');
UPDATE leave_balances SET earned_leave = 18,  casual_leave = 5,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4057');
UPDATE leave_balances SET earned_leave = 15,  casual_leave = 5,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4075');

-- VFL4xxx — 2025 year-end balance (no 2026 data; possible ex-employees)
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 1,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4014');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4016');
UPDATE leave_balances SET earned_leave = 14,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4021');
UPDATE leave_balances SET earned_leave = 20,  casual_leave = 1,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4029');
UPDATE leave_balances SET earned_leave = 0,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4038');
UPDATE leave_balances SET earned_leave = 11,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4040');
UPDATE leave_balances SET earned_leave = 21,  casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4061');

-- ============================================================================
-- Step 3: Corrections from "VFL Employee Salary Slip Generator 2026" (23 Sep 2026).
--   The leave sheet used "2026 Alloc" initial values for employees without a
--   "Sep26 Available" row. The salary slip generator calculates actual remaining
--   balances from real usage and is more accurate. These 24 employees had wrong
--   values in Steps 2–3 above; this overwrites them with salary-slip actuals.
-- ============================================================================
UPDATE leave_balances SET earned_leave = 11,   casual_leave = 1,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1482');
UPDATE leave_balances SET earned_leave = 18,   casual_leave = 0,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1516');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1520');
-- VFL1527 is severely overdrawn (-12/-1/-4); correct value from salary slip:
UPDATE leave_balances SET earned_leave = -12,  casual_leave = -1,   sick_leave = -4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1527');
UPDATE leave_balances SET earned_leave = 10,   casual_leave = 0,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1528');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1543');
UPDATE leave_balances SET earned_leave = 15,   casual_leave = 0,    sick_leave = 0.5
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1545');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1549');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 2,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1556');
UPDATE leave_balances SET earned_leave = 20,   casual_leave = 0,    sick_leave = 1.5
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1557');
UPDATE leave_balances SET earned_leave = 10,   casual_leave = 3,    sick_leave = 1
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1560');
UPDATE leave_balances SET earned_leave = 14,   casual_leave = 0.5,  sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1562');
UPDATE leave_balances SET earned_leave = 1,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1564');
UPDATE leave_balances SET earned_leave = 18,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1566');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL1567');
UPDATE leave_balances SET earned_leave = 15,   casual_leave = 0,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5079');
UPDATE leave_balances SET earned_leave = 19.5, casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5237');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5272');
UPDATE leave_balances SET earned_leave = 13,   casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5273');
UPDATE leave_balances SET earned_leave = 2,    casual_leave = 0,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5302');
UPDATE leave_balances SET earned_leave = 5,    casual_leave = 1,    sick_leave = 4
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5303');
UPDATE leave_balances SET earned_leave = 8,    casual_leave = 3,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5318');
UPDATE leave_balances SET earned_leave = 2,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL5321');
UPDATE leave_balances SET earned_leave = 0,    casual_leave = 0,    sick_leave = 0
  WHERE year = 2026 AND employee_id = (SELECT id FROM employees WHERE emp_code = 'VFL4057');

-- Verify
SELECT COUNT(*) AS total_rows FROM leave_balances;
SELECT
  CASE
    WHEN e.emp_code LIKE 'VFL1%' THEN 'VFL1xxx staff'
    WHEN e.emp_code LIKE 'VFL5%' THEN 'VFL5xxx staff'
    WHEN e.emp_code LIKE 'VFL4%' THEN 'VFL4xxx workers'
  END AS category,
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE lb.earned_leave = 0 AND lb.casual_leave = 0 AND lb.sick_leave = 0) AS zero_rows
FROM leave_balances lb
JOIN employees e ON e.id = lb.employee_id
GROUP BY 1
ORDER BY 1;

COMMIT;
