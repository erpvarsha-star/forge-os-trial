-- ============================================================================
-- PATCH_17 — chase the production forms, stop chasing the paperwork
-- 13 Aug 2026
--
-- Yash, 13 Aug: "all the forms related to production are to be chased."
--
-- All 24 daily forms stay listed in the app's Forms tab — is_active is
-- untouched, so nobody loses access to a form. This only changes which ones
-- the per-shift reminder nags about, because a reminder that lists six things
-- three times a day gets ignored, and then the three that matter get ignored
-- with it.
--
-- KEPT (18) — the production trio in every shop:
--   <Shop> PMS · <Shop> Daily check sheet · <Shop> (Shop) Planning
--   across Cutting, Forge, Press, Machine, HT and Final.
--
-- DROPPED FROM THE REMINDER (6) — real forms, but not production:
--   Overtime Form ................. HR/payroll, not a shift output
--   VFPL Sales Dispatch Actual .... dispatch (listed under Machine and Final)
--   Dispatch Plan-Machine Shop .... dispatch planning
--   57F4 Inward Form .............. excise/job-work movement
--   57F4 Outward Form ............. excise/job-work movement
--
-- ⚠ If that classification is wrong, it is one line to reverse — see the
-- bottom of this file. Nothing here is structural.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- ============================================================================

begin;

update public.form_links
   set send_in_reminder = false,
       updated_at       = now()
 where form_name in (
   'Overtime Form',
   'VFPL Sales Dispatch Actual Form',
   'Dispatch Plan-Machine Shop',
   '57F4 Inward Form',
   '57F4 Outward Form'
 );

-- Everything else is production and is chased. Stated positively as well as
-- negatively so a form added later defaults into the reminder rather than
-- quietly falling out of it.
update public.form_links
   set send_in_reminder = true,
       updated_at       = now()
 where form_name not in (
   'Overtime Form',
   'VFPL Sales Dispatch Actual Form',
   'Dispatch Plan-Machine Shop',
   '57F4 Inward Form',
   '57F4 Outward Form'
 )
   and is_active;

commit;

-- ============================================================================
-- Verify — expect 18 chased, 6 not.
-- ============================================================================
select send_in_reminder, count(*)
  from public.form_links
 where is_active
 group by 1
 order by 1 desc;

-- Per department, what will actually be chased:
-- select department, count(*) filter (where send_in_reminder) as chased,
--        count(*) as listed
--   from form_links where is_active group by 1 order by 1;

-- ============================================================================
-- TO PUT ONE BACK IN THE REMINDER:
--   update form_links set send_in_reminder = true where form_name = '57F4 Inward Form';
-- TO TAKE ONE OUT:
--   update form_links set send_in_reminder = false where form_name = 'Cutting Planning';
-- No redeploy either way — the edge function reads this column every run.
-- ============================================================================
