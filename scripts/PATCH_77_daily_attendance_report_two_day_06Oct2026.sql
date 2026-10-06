-- PATCH_77_daily_attendance_report_two_day_06Oct2026.sql
--
-- Fixes a real gap: PATCH_74's daily_attendance_report view was hardcoded
-- to "today" only. Yash: "we had agreed on previous day and current day" --
-- matches the original AttendanceReport.gs design (28 Sep 2026), which
-- deliberately processes yesterday (self-healing day-before-yesterday)
-- rather than today, specifically because Shift 3 belongs to the
-- previous working day and "today" is still in progress until Shift 3's
-- window closes at 06:45 IST. Widened to cover both IST calendar dates
-- (yesterday + today) per active employee, so Table Editor / SQL Editor
-- shows both without Yash needing to touch the date logic himself.

create or replace view public.daily_attendance_report as
select
  d.report_date,
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
from (
  select (now() at time zone 'Asia/Kolkata')::date as report_date
  union all
  select (now() at time zone 'Asia/Kolkata')::date - 1
) d
cross join employees e
left join attendance_records ar
  on ar.employee_id = e.id
  and ar.date = d.report_date
left join employee_shifts es
  on es.employee_id = e.id
  and es.date = d.report_date
left join shifts s
  on s.id = es.shift_id
where e.is_active = true
order by d.report_date desc, e.department, e.name;

revoke all on public.daily_attendance_report from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- select report_date, count(*) from daily_attendance_report group by report_date order by report_date desc;
-- Confirmed live 6 Oct 2026: 2 distinct report_date values, ~99 rows each.
