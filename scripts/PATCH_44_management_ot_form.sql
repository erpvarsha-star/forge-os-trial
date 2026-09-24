-- PATCH_44: Add Overtime Form for managers, plant_head, and owner
-- Uses virtual department 'MANAGEMENT' — FormsScreen fetches this for those roles.
-- Same Google Form URL used across all departments (confirmed by Yash).

INSERT INTO form_links (department, form_name, frequency, responsible_person, url, is_active, send_in_reminder, sort_order, is_common)
VALUES (
  'MANAGEMENT',
  'Overtime Form',
  'As Required',
  NULL,
  'https://docs.google.com/forms/d/e/1FAIpQLSf9zPvnTSMDE8AT_vrs9W8y2efwXxTbpJ2FlrRJl2TLoGKGXw/viewform',
  TRUE,
  FALSE,
  10,
  FALSE
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT department, form_name, url FROM form_links WHERE department = 'MANAGEMENT';
