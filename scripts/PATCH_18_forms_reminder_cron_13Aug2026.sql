-- ============================================================================
-- PATCH_18 — schedule the shift form reminder
-- 13 Aug 2026
--
-- WHAT A "CRON" IS HERE, AND WHY IT IS NEEDED
--
-- The reminder logic is already deployed — `forms_due_reminder` lives inside
-- the shift-reminder edge function and works. But an edge function is only a
-- URL: it does nothing until something calls it. The other two modes get
-- called because they are inferred from the day of the week; this one is not,
-- deliberately, because it has to run every 15 minutes rather than daily.
--
-- So without this file the feature is built, deployed, and never once fires.
--
-- Every 15 minutes it POSTs {"mode":"forms_due_reminder"} to the function.
-- The function itself decides whether anything is actually due — it only
-- notifies inside the 15-minute window before a shift's form deadline
-- (16:30 / 00:30 / 09:30) and dedupes, so one nudge goes out per shift, not
-- ninety-six a day.
--
-- ⚠ ONE BLANK TO FILL, BELOW. Replace PASTE_YOUR_KEY_HERE with a Supabase key
-- before running. Fill it in the SQL editor and run it there — the value is
-- stored in the cron job definition inside your own database, which is fine.
-- It must not be committed to git, which is why this file ships with the
-- placeholder.
--
-- Which key: the service role / sb_secret_ key. The function is invoked
-- server-to-server with no user session, so it needs a key that satisfies the
-- function gateway.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run — it unschedules the old
-- job first, so you will not end up with two.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Remove any previous copy of this job. Wrapped because cron.unschedule raises
-- if the job does not exist, which is the normal case on a first run.
do $$
begin
  perform cron.unschedule('forms-due-reminder');
exception when others then
  null;
end $$;

select cron.schedule(
  'forms-due-reminder',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/shift-reminder',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer PASTE_YOUR_KEY_HERE'
               ),
    body    := '{"mode":"forms_due_reminder"}'::jsonb
  );
  $job$
);

-- ============================================================================
-- Verify
-- ============================================================================
-- The job exists and is active:
select jobid, schedule, active
  from cron.job
 where jobname = 'forms-due-reminder';

-- After the next quarter hour, confirm it actually ran:
-- select status, return_message, start_time
--   from cron.job_run_details
--  where jobid = (select jobid from cron.job where jobname = 'forms-due-reminder')
--  order by start_time desc limit 5;
--
-- 'succeeded' means the POST was sent. To see what the FUNCTION did with it,
-- read its logs: Dashboard → Edge Functions → shift-reminder → Logs. A quiet
-- run returning {"dueShifts":[],"notified":0} is correct — that is the
-- fourteen times an hour when no deadline is close.

-- ============================================================================
-- TO STOP IT:   select cron.unschedule('forms-due-reminder');
-- TO RESCHEDULE: re-run this file with a different cron expression. Keep the
-- interval at or below 15 minutes, or the reminder window closes between two
-- invocations and the nudge is silently never sent.
-- ============================================================================
