-- PATCH_74_daily_attendance_report_view_06Oct2026.sql
--
-- Read-only reporting view, built for Whalesync (or any external
-- Postgres->Sheet sync tool Yash connects) to point at directly, instead
-- of needing custom SQL on the sync side. Same shape as the one-off CSV
-- already pushed into "Forge OS - Daily Attendance - 2026-10-06":
-- Date, Emp Code, Name, Department, Check In, Check Out, Working Hrs,
-- Late Mins, Overtime Hrs -- one row per active employee per day
-- (absent employees get a blank row, never dropped), always for "today"
-- in IST since the view re-evaluates now() on every read.
--
-- Not exposed to anon/authenticated -- this is for the service_role key
-- only (same key this project's other admin-side integrations already
-- use), never the app's own client-side queries.

create or replace view public.daily_attendance_report as
select
  (now() at time zone 'Asia/Kolkata')::date as report_date,
  e.emp_code,
  e.name,
  coalesce(e.department, '') as department,
  to_char(ar.check_in_time at time zone 'Asia/Kolkata', 'HH24:MI') as check_in,
  to_char(ar.check_out_time at time zone 'Asia/Kolkata', 'HH24:MI') as check_out,
  coalesce(
    ar.hours_worked,
    case when ar.check_in_time is not null then
      case
        when s.name in ('General', 'General (Pune)') then 9
        when s.name in ('Shift 4', 'Shift 5') then 12
        else 8.5
      end
    end
  ) as working_hrs,
  ar.late_minutes as late_mins,
  ar.overtime_hours as overtime_hrs
from employees e
left join attendance_records ar
  on ar.employee_id = e.id
  and ar.date = (now() at time zone 'Asia/Kolkata')::date
left join employee_shifts es
  on es.employee_id = e.id
  and es.date = (now() at time zone 'Asia/Kolkata')::date
left join shifts s
  on s.id = es.shift_id
where e.is_active = true
order by e.department, e.name;

revoke all on public.daily_attendance_report from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- select count(*) as row_count from public.daily_attendance_report;
-- Confirmed 6 Oct 2026: 99 rows, matching the live active headcount.
