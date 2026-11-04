-- PATCH_107 — daily Pune attendance reminder cron (renumbered from PATCH_104, 25 Oct 2026). Applied 25 Oct 2026.
-- Calls the pune-attendance-reminder edge function (verify_jwt false, idempotent per IST day)
-- at 13:30 UTC = 19:00 IST.
-- Rollback: select cron.unschedule('pune-attendance-reminder');
--
-- ⚠ CORRECTED 4 Nov 2026: the original version below omitted the Authorization
-- header entirely. The API gateway silently drops any request with no
-- Authorization header at all, before it ever reaches the function — so this
-- job "succeeded" every day since 26 Oct 2026 but never actually delivered a
-- single notification (0 app_notifications rows, 0 gateway log entries for
-- this function, ever). For a verify_jwt:false function the gateway only
-- needs *some* Authorization header present (the value is never checked) —
-- same pattern already used by the `auto-checkout` cron job. Fixed live via
-- `cron.alter_job` on the already-scheduled job (never dropped/recreated);
-- this file is corrected to match so a future reference/re-run doesn't
-- reproduce the bug. Do NOT re-run this file against a project where the job
-- already exists — it would just re-apply the same (now-corrected) command,
-- which is harmless, but there is no need to.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pune-attendance-reminder') then
    perform cron.unschedule('pune-attendance-reminder');
  end if;
end $$;

select cron.schedule(
  'pune-attendance-reminder',
  '30 13 * * *',
  $$select net.http_post(
      url := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/pune-attendance-reminder',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer no-auth-required'),
      body := '{}'::jsonb
  )$$
);
