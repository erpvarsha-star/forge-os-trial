-- PATCH_124: consultant weekly-off exclusion for CON01/CON20 (owner, 4 Nov 2026):
-- "weekly off is paid for consultants in general, EXCEPT CON01 and CON20."
--
-- mark_weekly_offs() (PATCH_86, 11 Oct 2026; last touched by PATCH_123,
-- 4 Nov 2026, which excluded security_guard role) writes a 'WO' row for every
-- active employee whose weekly-off day it is. All consultants currently have
-- weekly_off_day = NULL, so they default to Friday (coalesce(..., 5)) and get
-- a WO row like everyone else — confirmed live before this patch. This is a
-- pure 2-person emp_code exclusion, NOT a role/category exclusion: every other
-- consultant (CON05/09/12/13/24/etc.) keeps getting weekly-off WO rows exactly
-- as before. The existing security_guard role exclusion from PATCH_123 is left
-- untouched.
--
-- Payroll side: the engine/feedSync already treat a 'WO' row as a paid day
-- uniformly for every category once it exists (verified, see report) — no
-- engine change needed. CON01/CON20 simply never getting the WO row is
-- sufficient to make their weekly off unpaid.

create or replace function public.mark_weekly_offs(p_date date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count int;
begin
  insert into public.attendance_records (employee_id, date, status)
  select e.id, p_date, 'WO'
  from public.employees e
  where e.is_active
    and e.role <> 'security_guard'
    and e.emp_code not in ('CON01', 'CON20')
    and coalesce(e.weekly_off_day, 5) = extract(dow from p_date)::int
  on conflict (employee_id, date) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
