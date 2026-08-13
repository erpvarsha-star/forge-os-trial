-- ============================================================================
-- PATCH_20 — schedule the three edge functions that have never been scheduled
-- 13 Aug 2026
--
-- Prompted by "are you sure these are the only things pending?" — re-auditing
-- rather than re-listing turned this up. PATCH_18 scheduled shift-reminder's
-- forms_due_reminder mode because mode-inference never picks it on its own.
-- The same check against every OTHER "Daily" / "Nightly" edge function in
-- CLAUDE.md's table found no cron.schedule() for any of them, anywhere in
-- this repo:
--
--   nightly-scoring            — documented "Nightly 22:00 IST"
--   mrm-reminder                — documented "Daily"
--   five-s-challenge-generator  — documented "Daily"
--   shift-reminder (default)    — weekly_shift_notify / daily_checkin_reminder,
--                                  the two modes forms_due_reminder is NOT,
--                                  which rely on being invoked with no body
--                                  so day-of-week inference can pick a mode
--
-- ⚠ THIS DOES NOT PROVE THEY HAVE NEVER RUN. Supabase's dashboard has its own
-- native Cron UI (Database → Cron), separate from raw pg_cron SQL, and a
-- schedule created there would not appear in this repo. Check Dashboard →
-- Cron for existing jobs with these names before running this — if they are
-- already there, this patch's `perform cron.unschedule(...)` calls remove and
-- recreate them under the SAME job names, which is safe, not additive. If
-- they are NOT there, every one of these has been sitting deployed and idle
-- since it was written — matching the exact pattern already found and fixed
-- three times this session (forms_due_reminder, sendTelegramAlert, and the
-- notifications insert that silently failed for a week).
--
-- All four target functions are confirmed idempotent before being put on a
-- schedule at all — re-running them cannot duplicate data:
--   nightly-scoring:  upsert on (employee_id, year, month)
--   five-s-challenge-generator: upsert on (date)
--   mrm-reminder:     checked by reading its own source; ensures MRM rows
--                     exist rather than inserting unconditionally
--   shift-reminder:   weekly_shift_notify / daily_checkin_reminder both
--                     re-derive who to notify from live data each run, no
--                     insert-without-a-key anywhere
--
-- ⚠ ONE BLANK TO FILL, same as PATCH_18: replace PASTE_YOUR_KEY_HERE with a
-- Supabase key (service role / sb_secret_) before running, in the SQL editor
-- only — never commit a real key here.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('nightly-scoring');
  perform cron.unschedule('mrm-reminder');
  perform cron.unschedule('five-s-challenge-generator');
  perform cron.unschedule('shift-reminder-default');
exception when others then
  null;  -- normal on first run: nothing to unschedule yet
end $$;

-- 22:00 IST = 16:30 UTC
select cron.schedule(
  'nightly-scoring',
  '30 16 * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/nightly-scoring',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

-- 09:00 IST = 03:30 UTC — a morning check gives the 8th-10th escalation
-- window room to actually reach a manager before the day is half gone.
select cron.schedule(
  'mrm-reminder',
  '30 3 * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/mrm-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

-- 06:00 IST = 00:30 UTC — before the first shift starts, so the day's
-- challenge exists by the time anyone opens the app.
select cron.schedule(
  'five-s-challenge-generator',
  '30 0 * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/five-s-challenge-generator',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

-- No mode in the body, deliberately — this is the trigger that lets
-- shift-reminder's own day-of-week inference choose weekly_shift_notify
-- (Thursdays) or daily_checkin_reminder (every other day). Hourly, matching
-- the "Thursday + hourly" schedule CLAUDE.md has always documented for it.
select cron.schedule(
  'shift-reminder-default',
  '0 * * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/shift-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

-- ============================================================================
-- Verify
-- ============================================================================
select jobid, jobname, schedule, active
  from cron.job
 where jobname in ('nightly-scoring', 'mrm-reminder', 'five-s-challenge-generator', 'shift-reminder-default')
 order by jobname;

-- After the next run, confirm each actually fired:
-- select jobname, status, return_message, start_time
--   from cron.job_run_details jrd
--   join cron.job j on j.jobid = jrd.jobid
--  where j.jobname in ('nightly-scoring', 'mrm-reminder', 'five-s-challenge-generator', 'shift-reminder-default')
--  order by start_time desc limit 20;
--
-- For nightly-scoring specifically, the real check is data, not just a
-- 'succeeded' log line:
--   select count(*) from monthly_scores
--    where year = extract(year from now()) and month = to_char(now(), 'MM');
-- Zero rows the morning after this runs means the function itself is failing,
-- not the schedule — check Dashboard → Edge Functions → nightly-scoring → Logs.
--
-- ============================================================================
-- TO STOP ANY ONE OF THESE:  select cron.unschedule('<jobname>');
-- ============================================================================
