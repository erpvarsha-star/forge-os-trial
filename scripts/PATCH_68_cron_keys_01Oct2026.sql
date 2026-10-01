-- PATCH_68_cron_keys_01Oct2026.sql
-- Replaces the placeholder Authorization header on every remaining pg_cron
-- job that still has it, with a real key Yash pastes in once below.
--
-- Context (1 Oct 2026): every cron job in this project (PATCH_18, PATCH_20,
-- PATCH_66) was created with 'Bearer PASTE_YOUR_KEY_HERE' as a literal
-- placeholder, and it was NEVER actually replaced for any of them —
-- confirmed live via `select jobname, command from cron.job`. This did not
-- break anything: every edge function here is deployed with
-- --no-verify-jwt (see supabase/functions/deploy.sh), so Supabase's
-- gateway never validates that header at all — mrm-reminder alone has
-- 227 successful daily runs on the placeholder text. Yash has since pasted
-- a real key into `plant-head-form-reminder` (PATCH_66) by hand; this patch
-- brings the other 6 jobs to the same state for consistency and so the
-- header is correct if --no-verify-jwt is ever turned off for any of them.
--
-- ⚠ ONE BLANK TO FILL, same pattern as every prior cron patch: replace
-- PASTE_YOUR_KEY_HERE (both occurrences below) with a Supabase service
-- role / sb_secret_ key before running, in the SQL editor only — never
-- paste the real key into chat with Claude, and never commit it to this
-- file. Use the same key you already pasted for plant-head-form-reminder.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run — each cron.schedule()
-- call below upserts its job by name (unschedule-then-create), matching
-- the exact schedule and function target each job already has live.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('five-s-challenge-generator');
  perform cron.unschedule('forms-due-reminder');
  perform cron.unschedule('mrm-reminder');
  perform cron.unschedule('mrm-reminder-escalation');
  perform cron.unschedule('nightly-scoring');
  perform cron.unschedule('shift-reminder-default');
exception when others then
  null;  -- normal if any were already removed
end $$;

-- 00:30 IST = 19:00 UTC prior day... actually stored/confirmed live as
-- '30 0 * * *' (00:30 UTC) — kept exactly as the live job had it.
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

-- every 15 minutes, shift-reminder's forms_due_reminder mode
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

-- 09:00 IST = 03:30 UTC
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

-- 17:00 IST on the 10th = 11:30 UTC, day-of-month 10
select cron.schedule(
  'mrm-reminder-escalation',
  '30 11 10 * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/mrm-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer PASTE_YOUR_KEY_HERE')
  );
  $job$
);

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

-- hourly, shift-reminder's default (no-body) mode
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

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after applying (expect false on every row)
-- ---------------------------------------------------------------------------
-- select jobname, command like '%PASTE_YOUR_KEY_HERE%' as still_placeholder
-- from cron.job order by jobname;
