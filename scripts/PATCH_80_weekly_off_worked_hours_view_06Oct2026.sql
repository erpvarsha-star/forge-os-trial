-- PATCH_80_weekly_off_worked_hours_view_06Oct2026.sql
--
-- Yash: "friday check in is permited and mapped and query will be raised
-- to treat as OT as per hours." Confirmed Friday check-in was never
-- blocked (checked app code + RLS, 6 Oct) -- this is the missing query,
-- which did not exist before. Shows every attendance row that falls on
-- an employee's own weekly-off day (their employees.weekly_off_day if
-- set, else the company default Friday = dow 5), with the full
-- hours_worked for that day -- "treat as OT as per hours" per Yash's own
-- 6 Oct answer ("just a count for now"): visibility only, the whole
-- day's hours reported as worked-on-a-day-off, not a separate payroll
-- amount.

create or replace view public.weekly_off_worked_hours as
select
  ar.date,
  e.emp_code,
  e.name,
  e.department,
  coalesce(e.weekly_off_day, 5) as weekly_off_day,
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
  ) as hours_worked_as_ot
from attendance_records ar
join employees e on e.id = ar.employee_id
left join employee_shifts es on es.employee_id = ar.employee_id and es.date = ar.date
left join shifts s on s.id = es.shift_id
where ar.check_in_time is not null
  and extract(dow from ar.date) = coalesce(e.weekly_off_day, 5)
order by ar.date desc, e.department, e.name;

revoke all on public.weekly_off_worked_hours from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- READY-TO-RUN -- paste into Supabase SQL Editor:
-- ---------------------------------------------------------------------------
-- All weekly-off-day worked hours this month:
-- select * from weekly_off_worked_hours where date >= date_trunc('month', now())::date order by date desc;
--
-- Total weekly-off hours per employee this month (one row per person):
-- select emp_code, name, count(*) as days, sum(hours_worked_as_ot) as total_ot_hours
-- from weekly_off_worked_hours where date >= date_trunc('month', now())::date
-- group by emp_code, name order by total_ot_hours desc;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- Confirmed live 6 Oct 2026: Friday 2 Oct 2026 alone shows dozens of
-- employees who worked that day with real hours_worked_as_ot values
-- (e.g. VFL5460 Ashok Kumar, 10.33h).
