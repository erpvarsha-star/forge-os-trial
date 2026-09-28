-- PATCH_60: Deactivate VFL1319 (Dipak Balkrishna Patil, Accounts) — has left
-- 28 Sep 2026, Yash's confirmation.
--
-- Already flagged this session: his own salary sheet's Master Data marked
-- him "Non-Active" and he was on the never-logged-in list (must_change_pin
-- still true — never completed first login). Yash: "deactivate VFL1319 as
-- has left." No direct reports (supervisor_id/manager_id), so no reassignment
-- needed. Same pattern as PATCH_51: is_active=false is sufficient to block
-- login (resolve_login_identifier() filters is_active=true); row kept, not
-- deleted, per this project's audit-trail convention.

BEGIN;

UPDATE employees
SET is_active = false, updated_at = now()
WHERE emp_code = 'VFL1319' AND is_active = true;

SELECT emp_code, name, is_active FROM employees WHERE emp_code = 'VFL1319';

COMMIT;
