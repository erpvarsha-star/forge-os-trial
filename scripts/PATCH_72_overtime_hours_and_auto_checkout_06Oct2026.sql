-- PATCH_72_overtime_hours_and_auto_checkout_06Oct2026.sql
--
-- Two related changes from Yash, 6 Oct 2026:
--
-- 1. `attendance_records.overtime_hours` (nullable numeric) — set once a
--    day is finalized (manual checkout, or the new 24h auto-checkout job
--    below) by lib/workingHours.ts's finalizeShiftAndOvertime(): someone
--    who works 12h+ on what was Shift 1/Shift 3 is reclassified to the OT
--    variant (Shift 4/Shift 5) with overtime = hours_worked - 12;
--    otherwise overtime = max(0, hours_worked - that shift's own nominal
--    hours). VISIBILITY ONLY ("just a count for now") — this column is
--    never read by payroll_records or run-payroll, and nothing here
--    changes either of those.
--
-- 2. Schedules the new `auto-checkout` edge function hourly. Yash: "if
--    they dont check out in 24 hrs then we consider them checked out as
--    per their shift." The function itself (supabase/functions/
--    auto-checkout/index.ts) finds attendance_records rows checked in
--    24h+ ago with no checkout, fills check_out_time/hours_worked per the
--    existing no-checkout convention, and runs the same finalize-shift-
--    and-overtime logic as a manual checkout.
--
-- ⚠ Authorization header below is deliberately the literal string
-- 'Bearer no-auth-required', NOT a real key to fill in. Confirmed 1 Oct
-- 2026 (CLAUDE.md, "Cron jobs never had real keys"): every edge function
-- here is deployed with --no-verify-jwt (supabase/functions/deploy.sh),
-- so Supabase's API gateway never validates this header at all for any
-- of these cron-invoked functions — mrm-reminder ran 227 times on a
-- placeholder string before anyone noticed. There is nothing secret this
-- job's Authorization header actually needs to contain.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR (or via the Supabase MCP connector).
-- Safe to re-run — the column add is guarded, and cron.schedule() upserts
-- by job name (unschedule-then-create).

alter table attendance_records add column if not exists overtime_hours numeric;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

do $$
begin
  perform cron.unschedule('auto-checkout');
exception when others then
  null;  -- normal on first run: nothing to unschedule yet
end $$;

-- Hourly, matching shift-reminder's default mode / forms_due_reminder's
-- own cadence for time-sensitive jobs in this project.
select cron.schedule(
  'auto-checkout',
  '0 * * * *',
  $job$
  select net.http_post(
    url     := 'https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/auto-checkout',
    headers := jsonb_build_object('Authorization', 'Bearer no-auth-required')
  );
  $job$
);

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after applying
-- ---------------------------------------------------------------------------
-- select column_name from information_schema.columns
--   where table_name = 'attendance_records' and column_name = 'overtime_hours';
-- select jobname, schedule, active from cron.job where jobname = 'auto-checkout';
