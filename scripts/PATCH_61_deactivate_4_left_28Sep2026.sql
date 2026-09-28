-- PATCH_61: Deactivate 4 more employees confirmed left (Yash, 28 Sep 2026)
-- All 4 were on the never-logged-in list (must_change_pin=true).
--
-- CON22 Digambar Mahadeo Todekar and CON23 Suresh Sopan Gawali were added
-- this same session (PATCH_55) as confirmed re-hires (rejoined mid-June
-- 2026, per the real salary sheets). Payroll data confirms this isn't a
-- contradiction: both have real pay for June 2026, a sharp drop in July,
-- and nothing at all in August — consistent with them leaving again
-- shortly after rejoining. Yash now confirms this directly.
--
-- VFL5354 Rahul Ashok Patil (Machine Shop) — already flagged this session
-- as "Non-Active" in Yash's own sheet Master Data (see CLAUDE.md, "2 staff
-- employees" note); now confirmed.
--
-- VFL4048 Babasaheb Dagadu Randive (Forge Shop) — new, not previously
-- flagged.
--
-- None had ever logged in, none have direct reports. is_active=false is
-- sufficient to block login (resolve_login_identifier() filters
-- is_active=true); rows kept, not deleted, per this project's
-- audit-trail convention.

BEGIN;

UPDATE employees
SET is_active = false, updated_at = now()
WHERE emp_code IN ('CON22', 'CON23', 'VFL5354', 'VFL4048')
AND is_active = true;

SELECT emp_code, name, is_active FROM employees
WHERE emp_code IN ('CON22', 'CON23', 'VFL5354', 'VFL4048')
ORDER BY emp_code;

COMMIT;
