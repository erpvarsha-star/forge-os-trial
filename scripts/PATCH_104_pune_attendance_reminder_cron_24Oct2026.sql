-- PATCH_104 — daily Pune attendance reminder cron (24 Oct 2026). NOT YET APPLIED.
-- Calls the pune-attendance-reminder edge function (verify_jwt false, idempotent per IST day)
-- at 13:30 UTC = 19:00 IST. No Authorization header and no keys are needed.
-- Rollback: select cron.unschedule('pune-attendance-reminder');

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
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
  )$$
);
