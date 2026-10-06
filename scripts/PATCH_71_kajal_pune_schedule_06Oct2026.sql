-- PATCH_71_kajal_pune_schedule_06Oct2026.sql
-- Kajal (VFL1567, Pune office): 10am start, not General's 9am, and Sunday
-- weekly-off, not the company-wide Friday. Scoped to just her per Yash's
-- 6 Oct 2026 answer ("Just Kajal").
--
-- 1. employees.default_shift_id -- new, general-purpose column (nullable):
--    the shift to use when no employee_shifts row exists for a given date,
--    checked BEFORE falling back to the generic closest-shift inference
--    (lib/shiftInference.ts). Reusable for any future "this person's
--    normal hours differ from their department's shift" case, not a
--    Kajal-only hack.
-- 2. employees.weekly_off_day -- new, nullable smallint (0=Sunday..
--    6=Saturday). NULL means "company default, Friday" for everyone
--    except Kajal.
--    ** Storing this value alone does not yet change anything she sees.
--    No live code anywhere currently excludes ANY weekly-off day (not even
--    Friday, for anyone) from attendance-percentage denominators or
--    lateness flags -- confirmed by searching the whole repo for 'WO'
--    writes: the status exists only in one-time demo seed data, never in
--    live app/edge-function code. This is a separate, pre-existing,
--    company-wide gap this patch does not attempt to fix -- see chat /
--    PENDING.md, 6 Oct 2026, before building anything further on it.
-- 3. "General (Pune)" shift -- same 9h nominal and 30-min grace as
--    General, just 10:00-19:00 instead of 09:00-18:00.
-- 4. Kajal's default_shift_id -> General (Pune); weekly_off_day -> 0 (Sunday).

alter table employees add column if not exists default_shift_id uuid references shifts(id);
alter table employees add column if not exists weekly_off_day smallint check (weekly_off_day between 0 and 6);

insert into shifts (name, start_time, end_time, late_grace_minutes, is_night_shift)
select 'General (Pune)', '10:00', '19:00', 30, false
where not exists (select 1 from shifts where name = 'General (Pune)');

update employees
set default_shift_id = (select id from shifts where name = 'General (Pune)'),
    weekly_off_day = 0
where emp_code = 'VFL1567';

-- VERIFICATION:
-- select e.emp_code, e.weekly_off_day, s.name, s.start_time, s.end_time
-- from employees e left join shifts s on s.id = e.default_shift_id
-- where e.emp_code = 'VFL1567';
