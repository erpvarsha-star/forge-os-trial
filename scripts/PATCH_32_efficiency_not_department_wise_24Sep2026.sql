-- PATCH_32: Salary consolidation — Production Efficiency is NOT department-
-- scoped. Confirmed by Yash (24 Sep 2026): the achieved efficiency % is one
-- figure, the same for all 19 workers, entered once a month before salary
-- run — not per-department, and not daily.
--
-- This resolves the "Production Efficiency may not be department-scoped"
-- open question flagged in PENDING.md after Phase 3. PATCH_28's
-- `efficiency_incentive_slabs` and PATCH_30's `department_efficiency_actuals`
-- were both department-keyed based on an earlier, since-corrected reading
-- (the Aug 2026 "Efficiency Calculations" sheet listing several departments
-- under one shared 80% figure was the tell, not confirmed until now).
--
-- Both tables are empty of real use — efficiency_incentive_slabs only has
-- the 5 Forge Shop rows seeded in PATCH_28 (all under one `department`
-- value anyway, so dropping the column loses nothing), and
-- department_efficiency_actuals has never had a row written. Safe to alter
-- directly rather than needing a data migration.

BEGIN;

alter table efficiency_incentive_slabs drop column department;

drop table department_efficiency_actuals;

create table worker_efficiency_actuals (
  id uuid primary key default gen_random_uuid(),
  month text not null, -- zero-padded '01'-'12', matches payroll_records.month
  year integer not null,
  achieved_pct numeric not null,
  created_at timestamptz default now(),
  unique (month, year)
);

alter table worker_efficiency_actuals enable row level security;

create policy "worker_efficiency_actuals_select" on worker_efficiency_actuals
  for select using (is_management());

-- No insert/update policy — same convention as payroll_monthly_rates
-- (PATCH_31): service-role (edge function or admin) only.

COMMIT;
