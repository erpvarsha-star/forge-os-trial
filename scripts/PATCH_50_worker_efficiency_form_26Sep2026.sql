-- ============================================================================
-- PATCH_50 — Worker Monthly Efficiency form for Plant Head / Manager / Owner
-- 26 Sep 2026
--
-- Real URL from Yash. Same MANAGEMENT virtual-department pattern PATCH_44
-- used for the Overtime Form — FormsScreen.tsx already renders every
-- department='MANAGEMENT' row under "Management Forms" for manager,
-- plant_head and owner (components/FormsScreen.tsx: showMgmtForms). No app
-- code change needed; this is a live DB read, so it's visible the next time
-- Fazal (or any manager/owner) opens the Forms tab — no new APK required.
-- ============================================================================

-- No unique constraint on (department, form_name) to key an ON CONFLICT off
-- of — check for an existing row with this exact name before re-running,
-- rather than risk a silent duplicate.
insert into form_links (department, form_name, frequency, url, send_in_reminder, sort_order, is_common, is_active)
select 'MANAGEMENT', 'Worker Monthly Efficiency', 'Monthly',
  'https://docs.google.com/forms/d/e/1FAIpQLSdsJcfTrtL7Q194Ea1d9W7UaHlgeI1-kiwBZA-HBJ7AUswbsg/viewform',
  false, 20, false, true
where not exists (
  select 1 from form_links where department = 'MANAGEMENT' and form_name = 'Worker Monthly Efficiency'
);

-- ============================================================================
-- VERIFICATION — done 26 Sep 2026
-- ============================================================================
-- select department, form_name, url, sort_order from form_links
--   where department = 'MANAGEMENT' order by sort_order;
--   -> Overtime Form (10), Worker Monthly Efficiency (20)  ✅ confirmed
-- ============================================================================
