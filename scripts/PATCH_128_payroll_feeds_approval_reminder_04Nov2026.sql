-- PATCH_128 — daily Payroll Feeds approval reminder for HR (built 4 Nov 2026, owner said "yes").
--
-- WHAT: schedules a daily cron call to the new `payroll-feeds-approval-reminder`
-- edge function. No new tables — `payroll_canteen_entries` and
-- `payroll_society_recoveries` already exist (both have `approval_status`,
-- checked live before writing this, not assumed) and already hold real
-- pending rows (31 canteen + 20 society, entered by HR 2 Nov 2026, still
-- `approval_status='pending'` as of 4 Nov 2026).
--
-- WHY: flagged as a real gap in PENDING.md's 4 Nov resume block — "there is
-- still no reminder mechanism at all for HR approving the pending canteen/
-- society Payroll Feeds entries she's already entered." Owner's instruction
-- 4 Nov 2026 ("Complete what's pending") covers this. Scope confirmed in the
-- brief: HR admins ONLY (never owner/plant_head for this reminder), current
-- `payroll_month` only, one notification per HR admin per IST day while
-- anything is pending, nothing sent when nothing is pending.
--
-- ⚠ AUTHORIZATION HEADER — fixed from the start, do not regress. The SAME
-- SESSION found and fixed a real, live bug in `pune-attendance-reminder`'s
-- cron (see PATCH_107's correction comment and PENDING.md's 4 Nov resume
-- block): a verify_jwt:false function's cron job still needs the API
-- gateway to see SOME Authorization header, or the gateway silently drops
-- every request before it ever reaches the function — it had "succeeded"
-- daily for 9 days while delivering zero notifications. This job's
-- `net.http_post()` call includes `Authorization: 'Bearer no-auth-required'`
-- from the first version, same dummy value `auto-checkout`'s cron already
-- uses (the value is never checked by a verify_jwt:false function; it only
-- needs to be present so the gateway does not drop the request).
--
-- Schedule: 03:30 UTC = 09:00 IST daily — HR working-hours nudge. Does NOT
-- reuse 13:30 UTC (that is `pune-attendance-reminder`'s own slot, untouched)
-- and does NOT touch `shift-reminder-default`'s cron entry in any way.
--
-- Rollback: select cron.unschedule('payroll-feeds-approval-reminder');

do $$
begin
  if exists (select 1 from cron.job where jobname = 'payroll-feeds-approval-reminder') then
    perform cron.unschedule('payroll-feeds-approval-reminder');
  end if;
end $$;

select cron.schedule(
  'payroll-feeds-approval-reminder',
  '30 3 * * *',
  $$select net.http_post(
      url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/payroll-feeds-approval-reminder',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer no-auth-required'),
      body := '{}'::jsonb
  )$$
);
