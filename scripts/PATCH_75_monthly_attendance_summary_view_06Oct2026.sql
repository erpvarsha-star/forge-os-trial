-- PATCH_75_monthly_attendance_summary_view_06Oct2026.sql
--
-- Self-serve monthly review, built so Yash can answer "who's late",
-- "who's working overtime", "who's short on hours" directly in Supabase's
-- SQL Editor, without going through Claude -- using the exact same rules
-- the app itself uses (hooks/useLateComers.ts, lib/workingHours.ts,
-- constants/index.ts's PRESENT_STATUSES), so a manual answer here and the
-- app's own dashboards never disagree.
--
-- One row per employee per calendar month that has at least one
-- attendance_records row. Historical months are NOT filtered to active
-- employees only -- someone who later left still shows correctly in a
-- month they actually worked; is_active is exposed as a column so Yash
-- can filter it out himself if he wants current staff only.

create or replace view public.monthly_attendance_summary as
select
  date_trunc('month', ar.date)::date as month,
  e.id as employee_id,
  e.emp_code,
  e.name,
  e.department,
  e.category,
  e.is_active,
  count(*) filter (where ar.status in ('P', 'L', 'HL')) as days_present,
  count(*) filter (where ar.status = 'A') as days_absent,
  count(*) filter (where ar.status in ('L', 'HL')) as days_late,
  count(*) filter (where ar.hours_worked is not null and ar.hours_worked < 8.5) as days_short_hours,
  round(avg(ar.hours_worked)::numeric, 2) as avg_hours_worked,
  round(sum(coalesce(ar.overtime_hours, 0))::numeric, 2) as total_overtime_hours,
  sum(coalesce(ar.late_minutes, 0)) as total_late_minutes,
  count(*) as total_rows_this_month
from employees e
join attendance_records ar on ar.employee_id = e.id
group by e.id, e.emp_code, e.name, e.department, e.category, e.is_active, date_trunc('month', ar.date)
order by month desc, e.department, e.name;

revoke all on public.monthly_attendance_summary from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- READY-TO-RUN QUERIES -- paste these directly into Supabase SQL Editor.
-- ---------------------------------------------------------------------------

-- Who's late this month (>3 times -- same bar as the app's Late Comers Review):
-- select emp_code, name, department, days_late
-- from monthly_attendance_summary
-- where month = date_trunc('month', now())::date and days_late > 3
-- order by days_late desc;

-- Who's working overtime this month:
-- select emp_code, name, department, total_overtime_hours
-- from monthly_attendance_summary
-- where month = date_trunc('month', now())::date and total_overtime_hours > 0
-- order by total_overtime_hours desc;

-- Who's working short hours this month (>3 times below 8.5h):
-- select emp_code, name, department, days_short_hours, avg_hours_worked
-- from monthly_attendance_summary
-- where month = date_trunc('month', now())::date and days_short_hours > 3
-- order by days_short_hours desc;

-- Any past month -- just change the date:
-- select * from monthly_attendance_summary where month = '2026-09-01' order by department, name;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- Confirmed live 6 Oct 2026 against real October 2026 data -- top rows by
-- days_late matched expectations (VFL1482 Brahmanand Kaduba Tajne and
-- VFL5079 Sudeep Singh both at 5 late days, correctly above the >3 bar).
