-- PATCH_41: My Requests banner — common forms visible to every role in the Forms tab
-- Adds is_common column to form_links; rows with is_common=true appear under
-- "My Requests" for every employee regardless of department or role.
-- Leave Application and Advance Request are handled in-app (no row needed here).
-- Gate Pass, Cash Expenses, Hospital Form URLs must be updated by Yash after running.

ALTER TABLE form_links ADD COLUMN IF NOT EXISTS is_common BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO form_links (department, form_name, frequency, responsible_person, url, is_active, send_in_reminder, sort_order, is_common)
VALUES
  ('COMMON', 'Gate Pass',     'As Required', NULL, 'https://forms.gle/placeholder-update', TRUE, FALSE, 1, TRUE),
  ('COMMON', 'Cash Expenses', 'As Required', NULL, 'https://forms.gle/placeholder-update', TRUE, FALSE, 2, TRUE),
  ('COMMON', 'Hospital Form', 'As Required', NULL, 'https://forms.gle/placeholder-update', TRUE, FALSE, 3, TRUE)
ON CONFLICT DO NOTHING;
