-- PATCH_129 — two new reminder crons (round 6, 5 Nov 2026).
-- Owner approval: "create plan for this and start working at 5.30 am ist on
-- it" (see PENDING.md RESUME STATE "round 6" block, 4-5 Nov 2026 late
-- night, for the full plan this executes).
--
-- Both follow the Authorization-header lesson learned THIS SESSION from
-- pune-attendance-reminder's cron, which had NO Authorization header at all
-- for 9 days (26 Oct - 4 Nov 2026) and silently never delivered a single
-- notification, even though cron.job_run_details showed "succeeded" every
-- day (that status only means pg_cron successfully QUEUED the outbound
-- net.http_post() call, not that the API gateway accepted/delivered it).
-- Both jobs below send a dummy but PRESENT Authorization header from the
-- start — a verify_jwt:false function's gateway only needs SOME
-- Authorization header to avoid dropping the request; the value itself is
-- never checked by the function.
--
-- 1. plant-head-efficiency-reminder — daily, 04:00 UTC = 09:30 IST.
--    Nudges every active plant_head from the 1st of the IST month until a
--    payroll_efficiency_entries row exists for that payroll_month.
-- 2. accounts-advance-recovery-reminder — daily, 05:00 UTC = 10:30 IST.
--    Nudges whoever is role='manager' AND department='Accounts' about
--    advance_requests rows missing a usable monthly recovery figure.
--
-- Neither schedule collides with any existing cron.job entry (checked live
-- via `select jobname, schedule, active from cron.job` before picking these
-- slots — 04:00/05:00 UTC were both free).
--
-- Rollback:
--   select cron.unschedule('plant-head-efficiency-reminder');
--   select cron.unschedule('accounts-advance-recovery-reminder');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'plant-head-efficiency-reminder') then
    perform cron.unschedule('plant-head-efficiency-reminder');
  end if;
  if exists (select 1 from cron.job where jobname = 'accounts-advance-recovery-reminder') then
    perform cron.unschedule('accounts-advance-recovery-reminder');
  end if;
end $$;

select cron.schedule(
  'plant-head-efficiency-reminder',
  '0 4 * * *',
  $$select net.http_post(
      url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/plant-head-efficiency-reminder',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer no-auth-required'),
      body := '{}'::jsonb
  )$$
);

select cron.schedule(
  'accounts-advance-recovery-reminder',
  '0 5 * * *',
  $$select net.http_post(
      url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/accounts-advance-recovery-reminder',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer no-auth-required'),
      body := '{}'::jsonb
  )$$
);
