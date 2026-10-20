-- PATCH_97 — consultant salary masters + rate_type / daily_rate (21 Oct 2026)
-- Applied 2026-10-21 by owner (directly in SQL Editor). Recorded here afterwards
-- so the repo matches the DB. Do NOT re-run (it is written to be harmless if so).
--
-- Purpose: consultants had no employee_salary_structure row. Adds a rate model
-- (monthly vs daily) and seeds 12 consultant rate rows effective 2026-04-01.
--   monthly: ctc_annual = monthly CTC x 12, daily_rate NULL
--   daily:   daily_rate = per-day rate, ctc_annual = 0
--
-- Verified live read-only 21 Oct 2026: all 12 rows present and match the list
-- below exactly (is_active = true, effective_to NULL).
--
-- feedSync does NOT yet read rate_type / daily_rate; daily consultants are held
-- (MISSING_RATE) until that wiring lands.

alter table public.employee_salary_structure
  add column if not exists rate_type  text    not null default 'monthly',
  add column if not exists daily_rate numeric;

-- Constraint as it exists live: employee_salary_structure_rate_type_check
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'employee_salary_structure_rate_type_check'
                    and conrelid = 'public.employee_salary_structure'::regclass) then
    alter table public.employee_salary_structure
      add constraint employee_salary_structure_rate_type_check
      check (rate_type = any (array['monthly'::text, 'daily'::text]));
  end if;
end $$;

-- Monthly consultants (ctc_annual = monthly CTC x 12)
insert into public.employee_salary_structure (employee_id, rate_type, ctc_annual, daily_rate, effective_from)
select e.id, 'monthly', v.ctc_annual, null, date '2026-04-01'
  from (values ('CON05', 240000), ('CON09', 276000), ('CON12', 576000), ('CON13', 660000))
       as v(emp_code, ctc_annual)
  join public.employees e on e.emp_code = v.emp_code
 where not exists (select 1 from public.employee_salary_structure s
                    where s.employee_id = e.id and s.effective_from = date '2026-04-01');

-- Daily-rate consultants (ctc_annual = 0)
insert into public.employee_salary_structure (employee_id, rate_type, ctc_annual, daily_rate, effective_from)
select e.id, 'daily', 0, v.daily_rate, date '2026-04-01'
  from (values ('CON01', 700), ('CON16', 600), ('CON18', 650), ('CON20', 762),
               ('CON21', 846), ('CON22', 762), ('CON23', 625), ('CON24', 500))
       as v(emp_code, daily_rate)
  join public.employees e on e.emp_code = v.emp_code
 where not exists (select 1 from public.employee_salary_structure s
                    where s.employee_id = e.id and s.effective_from = date '2026-04-01');

-- Verify (expect 12 rows, matching the lists above)
select e.emp_code, s.rate_type, s.daily_rate, s.ctc_annual, s.effective_from
  from public.employee_salary_structure s
  join public.employees e on e.id = s.employee_id
 where e.category = 'consultant'
 order by e.emp_code;
