-- PATCH_42: Add Leave Application and Advance Application as common Google Form links
-- These replace the in-app leave/advance screens in the My Requests banner.
-- The in-app approval workflow (supervisor → manager → HR → accounts) is not yet built,
-- so Google Forms handles the submission and routing for now.
-- Yash must replace the placeholder URLs with real Google Form links.

INSERT INTO form_links (department, form_name, frequency, responsible_person, url, is_active, send_in_reminder, sort_order, is_common)
VALUES
  ('COMMON', 'Leave Application',   'As Required', NULL, 'https://forms.gle/placeholder-update', TRUE, FALSE, 0, TRUE),
  ('COMMON', 'Advance Application', 'As Required', NULL, 'https://forms.gle/placeholder-update', TRUE, FALSE, 0, TRUE)
ON CONFLICT DO NOTHING;
