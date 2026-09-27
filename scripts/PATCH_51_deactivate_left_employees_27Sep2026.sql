-- PATCH_51: Deactivate 25 employees confirmed no longer working (Yash's
-- "Left Employees List", 27 Sep 2026). All 25 had must_change_pin=true —
-- none had ever completed first login, so this closes that window rather
-- than removing an account someone is actively using.
--
-- is_active=false is sufficient to block login: resolve_login_identifier()
-- already filters `where e.is_active = true`, so a deactivated emp_code/
-- phone simply won't resolve to a synthetic email and login fails at that
-- step. Rows are NOT deleted — audit trail preserved, matches this
-- project's "no DELETE policies" convention.
--
-- KNOWN ISSUE surfaced by this patch, not fixed here: VFL1550 (Swapnil
-- Kakade, one of the 25) is still supervisor_id for 7 active employees
-- (VFL4032, VFL4008, VFL5413, VFL5318, VFL5347, VFL5409, VFL1450). This
-- patch does not reassign supervisor_id — needs HR to pick a real
-- replacement per this project's no-guessing rule, not Claude. Flagged in
-- PENDING.md.
--
-- Safe to re-run: WHERE emp_code IN (...) AND is_active = true, so a
-- second run affects zero rows.

BEGIN;

UPDATE employees
SET is_active = false, updated_at = now()
WHERE emp_code IN (
  'CON16','VFL5074','CON18','VFL4004','VFL4007','VFL5203','VFL5383',
  'VFL5425','CON21','VFL5323','VFL5410','VFL5420','VFL5428','VFL5429',
  'VFL4002','VFL1441','VFL1465','VFL5453','VFL5398','VFL5415','VFL4030',
  'VFL5445','VFL1568','VFL5083','VFL1550'
)
AND is_active = true;

-- Verify
SELECT emp_code, name, is_active FROM employees
WHERE emp_code IN (
  'CON16','VFL5074','CON18','VFL4004','VFL4007','VFL5203','VFL5383',
  'VFL5425','CON21','VFL5323','VFL5410','VFL5420','VFL5428','VFL5429',
  'VFL4002','VFL1441','VFL1465','VFL5453','VFL5398','VFL5415','VFL4030',
  'VFL5445','VFL1568','VFL5083','VFL1550'
)
ORDER BY emp_code;

COMMIT;
