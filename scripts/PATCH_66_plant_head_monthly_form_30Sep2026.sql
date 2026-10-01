-- PATCH_66_plant_head_monthly_form_30Sep2026.sql
-- Registers the Google Form Yash provided 30 Sep 2026 "for Fazal to be
-- filled by 5th of every month" into form_links (MANAGEMENT virtual
-- department, same pattern PATCH_50 used for Overtime Form / Worker Monthly
-- Efficiency — FormsScreen.tsx already renders every department='MANAGEMENT'
-- row under "Management Forms" for manager/plant_head/owner, so this is live
-- for Fazal immediately, no new APK needed), plus the pg_cron schedule for
-- the new `plant-head-form-reminder` edge function that sends him a daily
-- notification from the 1st to the 5th of each month while it's outstanding.
--
-- Could not read the form's own title (docs.google.com blocked by this
-- sandbox's egress proxy, same restriction already documented for every
-- other Google Forms link this project has handled) — form_name below is a
-- plain descriptive placeholder, not guessed content from inside the form.
-- Ask Yash to confirm/rename it if "Plant Head Monthly Form" doesn't match
-- what the form is actually called.
--
-- send_in_reminder = true here is NOT the PATCH_17 shift-deadline meaning
-- (that flag normally drives forms_due_reminder, which fires per shift
-- end-time and has nothing to do with MANAGEMENT-department rows). This new
-- edge function reads the same column with its own meaning: "chase this
-- form on the 1st-5th-of-month reminder," scoped to department='MANAGEMENT'
-- rows only, so it can never collide with forms_due_reminder's shift-based
-- logic, which never looks at MANAGEMENT rows at all.
--
-- ⚠ ONE BLANK TO FILL, same pattern as PATCH_18/PATCH_20: replace
-- PASTE_YOUR_KEY_HERE with a Supabase key (service role / sb_secret_) before
-- running, in the SQL editor only — never commit a real key here, and never
-- paste the actual key into chat with Claude.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run (schedule call
-- unschedules its own job name first; form_links insert is idempotent via
-- the WHERE NOT EXISTS guard).

insert into form_links (department, form_name, frequency, responsible_person, url, send_in_reminder, sort_order, is_active, is_common)
select 'MANAGEMENT', 'Plant Head Monthly Form', 'Monthly', 'Fazal Ilahi Khan',
  'https://docs.google.com/forms/d/e/1FAIpQLSdsJcfTrtL7Q194Ea1d9W7UaHlgeI1-kiwBZA-HBJ7AUswbsg/viewform',
  true, 30, true, false
where not exists (
  select 1 from form_links
  where department = 'MANAGEMENT'
    and url = 'https://docs.google.com/forms/d/e/1FAIpQLSdsJcfTrtL7Q194Ea1d9W7UaHlgeI1-kiwBZA-HBJ7AUswbsg/viewform'
);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('plant-head-form-reminder');
exception when others then
  null;  -- normal on first run: nothing to unschedule yet
end $$;

-- 09:00 IST = 03:30 UTC, same convention as mrm-reminder. The function
-- itself gates on day-of-month 1-5 IST, so it is harmless to also fire
-- outside that window (it just returns {skipped:true} and does nothing).
select cron.schedule(
  'plant-head-form-reminder',
  '30 3 * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/plant-head-form-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after applying
-- ---------------------------------------------------------------------------
-- select * from form_links where department = 'MANAGEMENT' order by sort_order;
-- select jobname, schedule, active from cron.job where jobname = 'plant-head-form-reminder';
