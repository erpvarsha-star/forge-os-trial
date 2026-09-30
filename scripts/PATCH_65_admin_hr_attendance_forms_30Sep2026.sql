-- PATCH_65_admin_hr_attendance_forms_30Sep2026.sql
-- Registers 4 Google Forms Yash provided 29-30 Sep 2026 into form_links, the
-- table driving each department's in-app Forms tab (same pattern as
-- PATCH_14/17/19/44). Could not read the forms' own content (docs.google.com
-- blocked by this sandbox's egress proxy, and the /d/e/<id>/viewform ID is a
-- public response-collection ID, not a resolvable Drive file ID) — every
-- fact below (form name, department, responsible person, frequency) is as
-- given directly by Yash via AskUserQuestion, not guessed:
--   - First 2 ("goes to kajal", relabeled "ea 1"/"ea link 2" in his next
--     message) -> confirmed via AskUserQuestion: Kajal, Administration dept.
--     "Administration" already exists as a real employees.department value
--     (Kajal Balkrishna Sutar VFL1567, Amit Bhagvan Shirsath VFL5434, Sarang
--     Kishor Shinde VFL5447) though this is its first form_links row.
--   - Last 2 ("goes to hr") -> Human Resource dept, responsible_person
--     matches the existing HR team wording already used on HR's 2 other
--     form_links rows (Milind/Pallavi/Mayuri), confirmed via AskUserQuestion.
--   - Form names given as "monthly attendence"/"daily attendence" for each
--     pair -> frequency set to "Monthly"/"Daily" to match (not separately
--     confirmed by Yash, but unambiguous from the names themselves and
--     consistent with every other frequency value already in this table).
-- send_in_reminder = false (these are attendance forms, not one of the 18
-- production forms PATCH_17 scoped for the shift-deadline reminder timer —
-- same treatment as HR's existing 2 manpower forms and the COMMON forms).
-- is_common = false (department-specific, not shown to every role).

insert into form_links (department, form_name, frequency, responsible_person, url, send_in_reminder, sort_order, is_active, is_common)
values
  ('Administration', 'Monthly Attendance', 'Monthly', 'Kajal Balkrishna Sutar',
   'https://docs.google.com/forms/d/e/1FAIpQLSd5YKrojx_EDEicZ4JwSMiSy4qgkHrn7VqigE3ILZGDYtPkdA/viewform',
   false, 10, true, false),
  ('Administration', 'Daily Attendance', 'Daily', 'Kajal Balkrishna Sutar',
   'https://docs.google.com/forms/d/e/1FAIpQLSdaEHR-ZwqxEnxX4jQwtMir1oyf6F_xrg7_GoN87t0y14bIhA/viewform',
   false, 20, true, false),
  ('Human Resource', 'Monthly Attendance', 'Monthly', 'Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod',
   'https://docs.google.com/forms/d/e/1FAIpQLSebOWlDL-by5-geFH8HyBj3H34sQLs5-mW9p1IoFNkq7ELLcA/viewform',
   false, 220, true, false),
  ('Human Resource', 'Daily Attendance', 'Daily', 'Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod',
   'https://docs.google.com/forms/d/e/1FAIpQLSfxBxQKxQk185WIwl7UQEdGFKV_6JIbB_qkExvd6qrKYLoF2A/viewform',
   false, 230, true, false);
