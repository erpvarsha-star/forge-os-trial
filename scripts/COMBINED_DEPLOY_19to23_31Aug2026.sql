-- ============================================================================
-- COMBINED DEPLOY — PATCH_19 + PATCH_20 + PATCH_21 + PATCH_22 + PATCH_23
-- 31 Aug 2026
--
-- Run this single file in Supabase SQL Editor to catch up everything
-- outstanding since PATCH_18 (applied 13 Aug 2026).
--
-- Included patches:
--   PATCH_19 — Maintenance / Manpower / VMC department forms expansion
--   PATCH_20 — Schedule the 4 edge-function crons that were never scheduled
--              (nightly-scoring, mrm-reminder, five-s-challenge-generator,
--               shift-reminder default, plus mrm-reminder-escalation at 17:00)
--   PATCH_21 — Create plant_locations table (multi-point geofence)
--   PATCH_22 — Seed 12 campus locations with real coordinates (received 13 Aug)
--   PATCH_23 — Seed 3 standard shifts so HR can assign them in the app
--
-- All 5 patches are idempotent — safe to re-run if any step was already done.
-- ============================================================================

-- ============================================================================
-- PATCH_19 — Maintenance (electricity + oil), Manpower (security + HR), VMC
-- 13 Aug 2026
--
-- Answers the open question from PATCH_14/PENDING.md: "Four ALERT.gs
-- departments are absent from the registry: Electricity, Oil, Staff Manpower,
-- Contract Manpower — which real department covers them?"
--
-- Yash, 13 Aug: "electricity, oil comes under maintenance and manpower comes
-- under security and hr — we need to add them, they need to feed it in, was
-- missed earlier in the earlier alert." Also: "we need to add VMC machine per
-- shift output."
--
-- Verified against the LIVE registry sheet (1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554)
-- via the Drive connector before writing this — not guessed. Real published
-- forms exist for all of this already:
--
--   Maintenance Shop  — 4 Daily forms: check sheet, TWO electricity forms
--                        (the sheet genuinely lists two — "VFPL Electricity
--                        Consumable Form" and "VFL 24Hrs Electricity
--                        Consumable Form" — both kept), and oil.
--   HR Dept + Security — the SAME 2 manpower forms ("Daily Manpower Form",
--                        "Daily Contractual Manpower Form") are listed under
--                        BOTH department labels in the registry, each with a
--                        different responsible person. Both marked "As & When
--                        Required" by the registry itself, not Daily — that
--                        cadence is respected below, not overridden.
--   VMC Shop          — 1 Daily form: "VMC Daily check sheet". This is the
--                        per-shift machine output form Yash asked for.
--
-- ⚠ employees.department HAS NO SEPARATE 'Security' VALUE. Security guards are
-- seeded with department = 'Human Resource' (EMPLOYEE_SEED_03Aug2026.sql —
-- role security_guard, e.g. VFL1441, VFL1465). The registry's "Security" and
-- "HR Dept" are two operational labels sharing one real employees.department
-- value, so both manpower forms are seeded ONCE under 'Human Resource' — a
-- second copy under a 'Security' department nothing in employees.department
-- ever matches would just never show up in anyone's Forms tab.
--
-- ⚠ WHAT THIS DOES NOT DO: push Electricity/Oil into production_records.
-- RAW_ELECTRICITY holds kWh meter readings and RAW_OIL holds litres consumed —
-- neither is "quantity of parts produced," and summing them into the same
-- number as Cutting/Forge/Press output would make the production dashboard
-- lie. See the matching ALERT.gs change, which excludes them from
-- syncProductionToSupabase() explicitly rather than by accident.
--
-- VMC has no RAW_VMC tab on the dashboard yet (checked the live sheet's tab
-- index — it isn't there), so VMC cannot get per-shift on-time/late/missing
-- compliance tracking until one exists. That's a dashboard-side gap, not
-- something to fabricate here. This patch gets the form into the app and the
-- reminder; compliance tracking for it is a separate, later piece.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run — same on-conflict
-- behaviour as PATCH_14: url/person/frequency/sort_order refresh, but
-- send_in_reminder is never touched by a re-run, so muting one of these later
-- sticks.
-- ============================================================================

begin;

insert into public.form_links
  (department, form_name, frequency, responsible_person, url, send_in_reminder, sort_order)
values
  ('Maintenance', 'Maintanance Daily check sheet', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLSeH-1oDurNeYxJDwXWEea6Gpmz3omIVv8WLjvN-SJBKvKKT9A/viewform', true, 10),
  ('Maintenance', 'VFPL Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScB6QrOCHmWeAKzZP76eWPISlt_tnr5z7aBROTHK614gfd31A/viewform', true, 20),
  ('Maintenance', 'VFL 24Hrs Electricity Consumable Form', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLScr2JYBV9yFN5WZj99dhc2mTV--1_-Y8pIeMT8Bmf6t9qR7RQ/viewform', true, 30),
  ('Maintenance', 'VFL Oil Consumable', 'Daily',
   'Atul Bhata Patil, Dharmendra Prabhu Mahto, Shaikh Majeed, Devendrakumar Jagdish Singh, Nanasaheb Dinkar Shinde, Shivaji Suresh Jaypure, Sunil Ramakant Saha, Vijay Rangnath Sonawane, Sandip Tryambak Landage, Manoj Anantrao Wagh',
   'https://docs.google.com/forms/d/e/1FAIpQLSfyrYgWEhyBjy8GxwvaaDOk5Uc5doDYZ0SeSE2uUoU9ujNUkA/viewform', true, 40),

  -- As & When Required, per the registry — not chased on the 15-minute shift
  -- timer, but visible in the Forms tab. Flip send_in_reminder to true if the
  -- real cadence should be daily instead; that is a policy call, not a typo.
  ('Human Resource', 'Daily Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security), Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSflyxcQjVEdv2OXgflXhKVH1VWhBUEMhC7KhUUUtdb4pHQNyw/viewform', false, 200),
  ('Human Resource', 'Daily Contractual Manpower Form', 'As & When Required',
   'Shrawan Rewant Singh (Security), Milind Ambadas Barhate / Pallavi Vishnu Khade / Mayuri Sardar Rathod (HR)',
   'https://docs.google.com/forms/d/e/1FAIpQLSfecNumIXRV7Xej_n-4N7k0K702I9WHjiT6F_naEqT5JnFS0g/viewform', false, 210),

  ('VMC Shop', 'VMC Daily check sheet', 'Daily',
   'Abhimanyu Kakde, Amol Rakhmaji Ambhore, Sayed Uzaif Ali Syed Altaf Ali',
   'https://docs.google.com/forms/d/e/1FAIpQLSdCv3PnoYHJy5H-y60hjwQTR4dBvC9mfKNNFiYMnFiZSD4pRw/viewform', true, 10)

on conflict (department, form_name) do update
  set url                = excluded.url,
      responsible_person = excluded.responsible_person,
      frequency           = excluded.frequency,
      sort_order          = excluded.sort_order,
      updated_at          = now();

commit;

-- ============================================================================
-- Verify
-- ============================================================================
-- select department, form_name, frequency, send_in_reminder
--   from form_links
--  where department in ('Maintenance', 'Human Resource', 'VMC Shop')
--  order by department, sort_order;
--  expect: 4 rows Maintenance (all send_in_reminder=true),
--          2 rows Human Resource (both send_in_reminder=false),
--          1 row VMC Shop (send_in_reminder=true)
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
--                     exist rather than inserting unconditionally. Its
--                     escalation notify is de-duplicated against
--                     `notifications` (fixed 13 Aug — see index.ts), so the
--                     extra mrm-reminder-escalation run below cannot
--                     double-notify the Plant Head.
--   shift-reminder:   weekly_shift_notify / daily_checkin_reminder both
--                     re-derive who to notify from live data each run, no
--                     insert-without-a-key anywhere
--
-- A fifth job, mrm-reminder-escalation, is also added below (13 Aug) — same
-- function, a second narrow cron entry, so the "10th at/after 17:00"
-- escalation branch documented in mrm-reminder/index.ts has an actual
-- invocation to fire on. See the comment beside that cron.schedule() call.
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
  perform cron.unschedule('mrm-reminder-escalation');
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

-- 17:00 IST on the 10th = 11:30 UTC, day-of-month 10 — added 13 Aug.
-- mrm-reminder's own escalation check is `dayOfMonth > dueDay || (dayOfMonth
-- === dueDay && hour >= 17)`, i.e. it promises to escalate to the Plant Head
-- starting at 17:00 on the due date itself. With only the once-daily 09:00
-- run above, that exact-hour branch could never be true — 09:00 is always
-- before 17:00, so on the 10th the condition never fires, and the earliest
-- the code could ever observe "past due" was the 11th's 09:00 run, a full
-- day later than documented. This second, narrow cron entry (day-of-month
-- pinned to 10, so it only ever fires once a month) exists solely to give
-- the 17:00-on-the-10th branch an actual invocation to fire on. Safe to run
-- alongside the 09:00 job on the same day: step 1 is upsert+ignoreDuplicates,
-- step 2's manager reminder is idempotent-by-design (documented as a daily
-- resend), and step 3's escalation is now de-duplicated against
-- `notifications` (see index.ts), so this extra run cannot double-escalate.
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
 where jobname in ('nightly-scoring', 'mrm-reminder', 'mrm-reminder-escalation', 'five-s-challenge-generator', 'shift-reminder-default')
 order by jobname;

-- After the next run, confirm each actually fired:
-- select jobname, status, return_message, start_time
--   from cron.job_run_details jrd
--   join cron.job j on j.jobid = jrd.jobid
--  where j.jobname in ('nightly-scoring', 'mrm-reminder', 'mrm-reminder-escalation', 'five-s-challenge-generator', 'shift-reminder-default')
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
-- ============================================================================
-- PATCH_21_plant_locations_13Aug2026.sql
--
-- Adds multi-point geofencing. Yash shared a sheet of 11 named locations
-- across the campus (Plant location, Office 1st Floor, Machine shop, Die
-- shop, VMC shop, Press Shop, HT shop, Forge shop, Cutting shop, Final Shop,
-- Raw Material) as Google Maps links. Decision (13 Aug): "multi-point, any
-- match" — a check-in succeeds if the employee is within radius of ANY of
-- these points, not tied to their own department. The single campus is
-- large enough that one center point + 100m (plant_config) was missing
-- far-flung shops like the Raw Material yard.
--
-- This patch only creates the TABLE — it seeds ZERO rows. The Google Maps
-- links resolve to real GPS coordinates, and this sandbox's network egress
-- proxy blocks every Google Maps domain (maps.app.goo.gl, google.com/maps),
-- so those coordinates could not be read here — writing guessed lat/lng
-- values into a table that gates physical plant access would be worse than
-- leaving it empty. The app and fraud-detector both already fall back
-- automatically to the existing single-point plant_config geofence when
-- this table is empty, so running this patch now is safe and changes
-- nothing about current behaviour. Once real coordinates are provided,
-- PATCH_22 will insert the 11 rows and check-in switches over automatically
-- — no further app code changes needed.
-- ============================================================================

create table if not exists plant_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_plant_locations_active on plant_locations(is_active);

alter table plant_locations enable row level security;

-- Readable by any signed-in employee, same as plant_config — the app needs
-- this list client-side to run the geofence check before it even attempts
-- check-in.
drop policy if exists "plant_locations_select" on plant_locations;
create policy "plant_locations_select" on plant_locations for select using (auth.uid() is not null);

-- Only management can add/edit/remove locations — same rationale as every
-- other config-shaped table in this schema (plant_config has no client
-- write path at all; this is more permissive only because a shop can
-- reasonably be added between SQL sessions without redeploying).
drop policy if exists "plant_locations_write_management" on plant_locations;
create policy "plant_locations_write_management" on plant_locations for all
  using (is_management())
  with check (is_management());

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
select 'plant_locations table created, 0 rows (expected — see header comment)' as status,
       count(*) as row_count
from plant_locations;
-- ============================================================================
-- PATCH_22_plant_locations_seed_13Aug2026.sql
--
-- Seeds plant_locations (created by PATCH_21, run that one first) with the
-- 12 campus points Yash surveyed and sent as a CSV with coordinates already
-- resolved (this sandbox cannot reach any Google Maps domain to resolve the
-- links itself — see PENDING.md). "Store" is a 12th point that wasn't in
-- the original 11-location sheet but was included in the coordinates file,
-- so it's seeded too.
--
-- Sanity-checked before writing this (not just pasted blind): every point
-- is within 131m of "Plant location" (Machine shop is the farthest, at
-- 131.3m — which means it sat just OUTSIDE the old single-point 100m
-- geofence, a real, concrete case this multi-point upgrade fixes). One
-- oddity worth knowing about: "Cutting shop" and "Final Shop" were sent
-- with IDENTICAL coordinates (19.836111, 75.236750) — seeded as given since
-- it doesn't break anything (both still independently widen the "any
-- match" set to the same physical spot), but flagging it in case that's a
-- copy-paste slip in the source sheet rather than a real coincidence — see
-- PENDING.md.
--
-- Radius: 100m per point, matching the existing plant_config default —
-- deliberately not tightened per-shop, since the design intent (13 Aug
-- decision) is broad "any of these counts" coverage, not per-shop access
-- control.
-- ============================================================================

insert into plant_locations (name, latitude, longitude, radius_meters) values
  ('Plant location',   19.836056, 75.236222, 100),
  ('Office 1st Floor', 19.835928, 75.236184, 100),
  ('Machine shop',     19.835944, 75.237472, 100),
  ('Die shop',         19.836139, 75.236611, 100),
  ('VMC shop',         19.836167, 75.236472, 100),
  ('Press Shop',       19.836222, 75.236444, 100),
  ('HT shop',          19.836139, 75.236556, 100),
  ('Forge shop',       19.836306, 75.236500, 100),
  ('Cutting shop',     19.836111, 75.236750, 100),
  ('Final Shop',       19.836111, 75.236750, 100),
  ('Raw Material',     19.836083, 75.236833, 100),
  ('Store',            19.836109, 75.236702, 100)
on conflict (name) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_meters = excluded.radius_meters;

-- ---------------------------------------------------------------------------
-- Verify — expect 12 rows, all is_active
-- ---------------------------------------------------------------------------
select name, latitude, longitude, radius_meters, is_active from plant_locations order by name;
-- ============================================================================
-- PATCH_23 — seed the three standard plant shifts
-- 31 Aug 2026
--
-- PROBLEM: shifts table has been empty since FINAL_SCHEMA was deployed.
--   employee_shifts has a NOT NULL FK on shift_id → shifts(id), so HR Admin's
--   shifts.tsx "Assign Shift" modal has never had anything to pick, making it
--   impossible to populate employee_shifts at all.
--   shift-reminder's daily_checkin_reminder mode joins employee_shifts to
--   shifts on start_time — with no rows it always returned notified:0.
--
-- FIX: insert the three real VFPL shift timings (from plant_config's
--   form_shift_schedule, confirmed live since PATCH_14).
--   Shift 3 crosses midnight → is_night_shift = true.
--   Idempotent: ON CONFLICT (name) DO NOTHING — safe to re-run.
--
-- AFTER RUNNING: HR Admin can immediately open the Shifts screen and assign
--   shifts to employees. shift-reminder's daily check-in reminder will also
--   start firing once employee_shifts has rows.
-- ============================================================================

-- Add a unique constraint on name so the ON CONFLICT clause works.
-- DO NOTHING if it already exists (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shifts_name_key' AND conrelid = 'shifts'::regclass
  ) THEN
    ALTER TABLE shifts ADD CONSTRAINT shifts_name_key UNIQUE (name);
  END IF;
END
$$;

INSERT INTO shifts (name, start_time, end_time, is_night_shift)
VALUES
  ('Shift 1', '08:30', '15:30', false),
  ('Shift 2', '15:30', '23:30', false),
  ('Shift 3', '23:30', '08:30', true)
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT name, start_time, end_time, is_night_shift FROM shifts ORDER BY start_time;
-- Expected: 3 rows
