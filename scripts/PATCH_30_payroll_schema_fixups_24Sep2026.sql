-- PATCH_30: Salary consolidation — Phase 3 schema fix-up.
-- Plan: /root/.claude/plans/zazzy-sauteeing-crystal.md (session 24 Sep 2026).
--
-- Two small gaps found while writing the run-payroll edge function:
--
-- 1. `payroll_records.other_deduction` was missed in PATCH_28. The blueprint
--    always listed "Other Deduction" as its own genuinely one-off line,
--    distinct from TDS (which already existed in the original schema) --
--    PATCH_28's column list simply dropped it by oversight.
--
-- 2. Production Efficiency needs somewhere to read the department's
--    achieved % from. The approved blueprint says this is entered ONCE per
--    department per month, not repeated per employee -- so it gets its own
--    small table rather than being passed redundantly on every employee's
--    payroll call.

BEGIN;

alter table payroll_records add column if not exists other_deduction numeric default 0;

create table department_efficiency_actuals (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  month text not null, -- zero-padded '01'-'12', matches payroll_records.month
  year integer not null,
  achieved_pct numeric not null,
  created_at timestamptz default now(),
  unique (department, month, year)
);

alter table department_efficiency_actuals enable row level security;

create policy "department_efficiency_actuals_select" on department_efficiency_actuals
  for select using (is_management());

-- No insert/update policy -- same convention as the rest of this project's
-- reference/input tables: service-role (edge function or admin) only.

COMMIT;
