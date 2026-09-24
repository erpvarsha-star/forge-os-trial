-- ============================================================================
-- PATCH_36 — Security department + gate forms (25 Sep 2026)
--
-- Two changes:
--
-- 1. Security guards were stored under department='Human Resource', which
--    meant their Forms tab showed Pallavi's HR manpower forms. The form
--    registry (shared by Yash) lists all 5 security guards under a
--    'Security' department. Updated to match.
--
-- 2. Added 4 gate-specific form_links for the Security department:
--    - Gate Pass        (primary gate control form)
--    - 57F4 Inward      (material coming in — "57 AT" in Yash's terminology)
--    - 57F4 Outward     (material going out — "Out Material" in Yash's terminology)
--    - Late Attendance  (for employees arriving late at the gate)
--
--    57F4 Inward/Outward URLs reuse the same forms already in form_links
--    under Final Shop — same Google Form, different department scope.
--
-- Safe to re-run: UPDATE is idempotent, INSERT has ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

UPDATE employees
SET department = 'Security'
WHERE role = 'security_guard';

INSERT INTO form_links (department, form_name, url, send_in_reminder, sort_order)
VALUES
  ('Security', 'Gate Pass',       'https://docs.google.com/forms/d/e/1FAIpQLSdckWth804L-MQsJf8P-ndpgSYzpWCAEJZBNlc13fIdt6GqMw/viewform', false, 10),
  ('Security', '57F4 Inward',     'https://docs.google.com/forms/d/e/1FAIpQLSdHaCr9PfjKFv_nRIQGy_0uBo6SmoXfJe06ZNWW5-zBONkA-w/viewform', false, 20),
  ('Security', '57F4 Outward',    'https://docs.google.com/forms/d/e/1FAIpQLSdfReEVbGGGNC6CwIPDq53syvvkomXj2gfIWNBQehjozUD1DA/viewform', false, 30),
  ('Security', 'Late Attendance', 'https://docs.google.com/forms/d/e/1FAIpQLSdjdqyrJoyOTNt-opXb-XjDWBsdyGA4eKjY0F45pHrHBZHr5w/viewform', false, 40)
ON CONFLICT DO NOTHING;

COMMIT;
