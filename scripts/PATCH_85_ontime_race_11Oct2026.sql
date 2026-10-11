-- PATCH_85: monthly on-time race (Yash, 11 Oct 2026).
-- Each employee sees only their OWN rank in their group; only the owner sees
-- who is #1 per group. Group = (work_location, category). Ranks follow the
-- current late rules: on-time day = attendance status 'P', late = 'L'.
-- Groups smaller than 3 participants get NULL rank (Pune today).

alter table public.employees add column if not exists work_location text not null default 'Aurangabad';
update public.employees set work_location = 'Pune' where emp_code in ('VFL1567', 'VFL5439');

-- Internal: not granted to anyone but the function owner.
create or replace function public.ontime_race_standings(p_month date default null)
returns table (
  employee_id uuid, emp_code text, name text, department text, category text,
  work_location text, on_time_days int, late_days int, group_size int, rank int, month date
)
language sql stable security definer set search_path = public as $$
  with const as (
    select 3 as min_group_size,   -- MIN_GROUP_SIZE: smaller groups are not ranked
           date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Kolkata')::date))::date as m
  ),
  parts as (
    select e.id, e.emp_code, e.name, e.department, e.category, e.work_location,
           (select count(*) from attendance_records a
             where a.employee_id = e.id and a.status = 'P'
               and a.date >= c.m and a.date < (c.m + interval '1 month')::date)::int as on_time_days,
           (select count(*) from attendance_records a
             where a.employee_id = e.id and a.status = 'L'
               and a.date >= c.m and a.date < (c.m + interval '1 month')::date)::int as late_days
    from employees e, const c
    where e.is_active and e.role <> 'owner'
  ),
  sized as (
    select p.*, count(*) over (partition by p.work_location, p.category)::int as group_size,
           rank() over (partition by p.work_location, p.category
                        order by p.on_time_days desc, p.late_days asc)::int as rnk
    from parts p
  )
  select s.id, s.emp_code, s.name, s.department, s.category, s.work_location,
         s.on_time_days, s.late_days, s.group_size,
         case when s.group_size >= c.min_group_size then s.rnk end, c.m
  from sized s, const c;
$$;
revoke all on function public.ontime_race_standings(date) from public, anon, authenticated;

-- Caller's own rank only. No names, no other rows.
create or replace function public.my_ontime_rank()
returns table (rank int, group_size int, on_time_days int, category text, work_location text, month date)
language sql stable security definer set search_path = public as $$
  select s.rank, s.group_size, s.on_time_days, s.category, s.work_location, s.month
  from ontime_race_standings(null) s
  where s.employee_id = current_employee_id();
$$;
revoke all on function public.my_ontime_rank() from public, anon;
grant execute on function public.my_ontime_rank() to authenticated;

-- Owner only: every rank-1 participant (ties included) per group.
create or replace function public.ontime_race_leaders()
returns table (
  emp_code text, name text, department text, category text, work_location text,
  on_time_days int, late_days int, group_size int, month date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if get_current_employee_role() is distinct from 'owner' then
    raise exception 'owner only';
  end if;
  return query
    select s.emp_code, s.name, s.department, s.category, s.work_location,
           s.on_time_days, s.late_days, s.group_size, s.month
    from ontime_race_standings(null) s
    where s.rank = 1
    order by s.work_location, s.category, s.name;
end $$;
revoke all on function public.ontime_race_leaders() from public, anon;
grant execute on function public.ontime_race_leaders() to authenticated;
