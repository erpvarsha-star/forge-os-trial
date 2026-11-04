-- PATCH_123: security guards have NO weekly off (owner, 4 Nov 2026):
-- "security will now check in with gps to mark attendance and they dont have
-- weekly off they work through the month."
--
-- mark_weekly_offs() (PATCH_86, 11 Oct 2026) wrote a 'WO' row for every active
-- employee on coalesce(weekly_off_day, 5) = today's weekday — Friday default,
-- Kajal (VFL1567) Sunday. role='security_guard' had no exclusion, so the 3
-- active security guards (VFL1520, VFL1527, VFL5439) were being given a
-- Friday 'WO' row like everyone else, even though they work every day of the
-- month. Fixed by excluding role='security_guard' from the insert entirely —
-- distinct from Kajal's "Sunday instead of Friday" case: security guards get
-- no weekly-off day at all, not a different one.
--
-- Does NOT retroactively remove any 'WO' rows already written for security
-- guards before this patch (not asked for; a later real check-in on that date
-- would already overwrite 'WO' with 'P'/'L' via the normal upsert-on-conflict
-- behaviour, same as any other employee).

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
    and e.role <> 'security_guard'
    and coalesce(e.weekly_off_day, 5) = extract(dow from p_date)::int
  on conflict (employee_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_weekly_offs(date) from public, anon, authenticated;
