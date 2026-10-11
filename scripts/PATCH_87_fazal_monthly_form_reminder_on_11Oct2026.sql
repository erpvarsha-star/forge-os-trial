-- PATCH_87: turn on Fazal's 1st-5th monthly reminder (11 Oct 2026)
--
-- PATCH_66 tried to insert 'Plant Head Monthly Form' with a URL that was
-- already registered as MANAGEMENT 'Worker Monthly Efficiency' (PATCH_50).
-- Its WHERE NOT EXISTS guard (matched on url) therefore skipped the insert,
-- and the existing row had send_in_reminder=false, so the
-- plant-head-form-reminder cron ran daily but never had a form to remind about.
-- Fazal's monthly form IS "Worker Monthly Efficiency" — same link.
--
-- Safe for shift-reminder's forms_due_reminder: no active employee has
-- department='MANAGEMENT', so that daily nudge finds nobody to notify.
update form_links set send_in_reminder = true
where department = 'MANAGEMENT' and form_name = 'Worker Monthly Efficiency';
