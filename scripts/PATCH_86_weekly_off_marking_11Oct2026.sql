-- PATCH_86: mark weekly-off days as 'WO' (decision from Yash, 11 Oct 2026)
--
-- Rule: a weekly-off day is never an absence. Weekly off = Friday for everyone,
-- except employees with employees.weekly_off_day set (0=Sunday..6=Saturday;
-- today only VFL1567 Kajal = 0).
--
-- Every counter already excludes status='WO' from denominators, but nothing
-- ever wrote it. This function pre-writes a 'WO' row for each active employee
-- on their off day. ON CONFLICT DO NOTHING means an existing row (a real
-- check-in, any status) always wins. If someone later works their off day,
-- check-in upserts on (employee_id, date) and overwrites 'WO' with 'P'/'L', so
-- working an off day is a normal working day.
--
-- Only cron / service role runs it (no grants to app roles). No DROP statements.

create or replace function public.mark_weekly_offs(p_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.attendance_records (employee_id, date, status)
  select e.id, p_date, 'WO'
  from public.employees e
  where e.is_active
    and coalesce(e.weekly_off_day, 5) = extract(dow from p_date)::int
  on conflict (employee_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_weekly_offs(date) from public, anon, authenticated;

-- 00:01 IST daily = 18:31 UTC. Same job name re-schedules in place (pg_cron >= 1.4).
select cron.schedule(
  'mark-weekly-offs',
  '31 18 * * *',
  $$select public.mark_weekly_offs((now() at time zone 'Asia/Kolkata')::date)$$
);

-- Backfill 1-11 Oct 2026 (1 Oct = go-live; earlier test-mode data untouched).
select d::date as day, public.mark_weekly_offs(d::date) as inserted
from generate_series('2026-10-01'::date, '2026-10-11'::date, interval '1 day') d;
