-- PATCH_28: Salary consolidation — Phase 1 (schema only, no employee financial
-- data seeded yet). Plan: /root/.claude/plans/zazzy-sauteeing-crystal.md
-- (session 24 Sep 2026 — "Salary system consolidation").
--
-- Scope: pure schema additions, additive only. Nothing here changes existing
-- app behavior — payslip.tsx, payroll_records reads, leave flows all keep
-- working unchanged until later phases populate the new columns.
--
-- What's deliberately NOT in this patch (per the approved plan):
--   - employee_salary_structure stays EMPTY — seeding it from the master
--     spreadsheet is Phase 2, gated on Yash confirming that data is current.
--   - efficiency_incentive_slabs is seeded (Forge Shop's known union-agreement
--     slabs), but only Forge Shop — other departments' agreements unconfirmed.
--   - pt_slabs IS seeded — Yash shared the real Maharashtra slab table
--     (male/female, with the February true-up noted in remarks) in this
--     session, so this one ships with real data, not a placeholder.
--   - No employee gender values are set — the column is added, existing rows
--     stay NULL until HR fills them in (needed for PT; nothing pays PT off a
--     NULL gender, so this is safe to ship empty).

BEGIN;

-- ============================================================================
-- SECTION A — employees: add gender (needed for PT slab lookup — the real
-- slabs Yash shared are gender-differentiated: male threshold ₹10,001,
-- female threshold ₹25,001)
-- ============================================================================

alter table employees add column if not exists gender text check (gender in ('male','female'));

-- ============================================================================
-- SECTION B — employee_salary_structure (new)
-- The piece Forge OS never had: CTC + every fixed monthly component amount,
-- plus bank/UAN/PAN/ESI details (confirmed absent from `employees` before
-- this patch). One row per employee per effective period — versioned so a
-- future increment doesn't overwrite history.
-- ============================================================================

create table employee_salary_structure (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  ctc_annual numeric not null default 0,
  -- components common to both categories
  basic numeric not null default 0,
  hra numeric not null default 0,
  conveyance numeric not null default 0,
  washing numeric default 0,
  education numeric default 0,
  -- worker-specific (NULL for staff)
  heat_allow numeric default 0,
  vda numeric default 0,
  production_allow numeric default 0,
  -- staff-specific (NULL for workers)
  medical numeric default 0,
  professional_development numeric default 0,
  communication numeric default 0,
  uniform numeric default 0,
  -- bank + statutory identifiers — APP-VERIFIED absent from `employees`
  bank_name text,
  ifsc text,
  account_no text,
  uan text,
  pan text,
  esi_no text,
  effective_from date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  unique (employee_id, effective_from)
);

create index idx_employee_salary_structure_employee on employee_salary_structure(employee_id);

alter table employee_salary_structure enable row level security;

create policy "employee_salary_structure_select" on employee_salary_structure
  for select using (employee_id = current_employee_id() or is_management());

-- No insert/update/delete policy — matches payroll_records' existing
-- convention: writes only via a service-role edge function or admin session,
-- never directly from the client.

-- ============================================================================
-- SECTION C — payroll_records: additive columns only
-- Confirmed-days breakdown (never stored before — payroll_records held only
-- the final computed numbers), OT hours, the one-off fields with no column
-- today (canteen/society/mlwf/arrears/dispatch_incentive/other_allowance),
-- a production-efficiency clawback line, and status + updated_at to support
-- the dual entry-path (app + sheet sync) "last write wins" rule from the plan.
-- ============================================================================

alter table payroll_records add column if not exists working_days numeric;
alter table payroll_records add column if not exists present_days numeric;
alter table payroll_records add column if not exists el numeric default 0;
alter table payroll_records add column if not exists cl numeric default 0;
alter table payroll_records add column if not exists sl numeric default 0;
alter table payroll_records add column if not exists ph numeric default 0;
alter table payroll_records add column if not exists days_payable numeric;
alter table payroll_records add column if not exists ot_hours numeric default 0;
alter table payroll_records add column if not exists canteen numeric default 0;
alter table payroll_records add column if not exists society numeric default 0;
alter table payroll_records add column if not exists mlwf numeric default 0;
alter table payroll_records add column if not exists arrears numeric default 0;
alter table payroll_records add column if not exists dispatch_incentive numeric default 0;
alter table payroll_records add column if not exists other_allowance numeric default 0;
alter table payroll_records add column if not exists production_efficiency_deduction numeric default 0;
alter table payroll_records add column if not exists status text default 'draft' check (status in ('draft','final'));
alter table payroll_records add column if not exists updated_at timestamptz default now();

-- Reuse the existing set_updated_at() trigger function (already defined in
-- this project, used elsewhere) rather than inventing a new one.
drop trigger if exists payroll_records_set_updated_at on payroll_records;
create trigger payroll_records_set_updated_at
  before update on payroll_records
  for each row execute function set_updated_at();

-- ============================================================================
-- SECTION D — pt_slabs (new, seeded with real data shared by Yash 24 Sep 2026)
-- Gender-differentiated Maharashtra PT slabs. The February ₹300 true-up
-- (instead of the usual ₹200) is a per-month exception on the same slab, not
-- a separate threshold — documented in `remarks`, applied in the calc engine
-- (Phase 3), not modeled as a second slab row.
-- ============================================================================

create table pt_slabs (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('male','female')),
  min_gross numeric not null,
  max_gross numeric, -- null = no upper bound
  pt_amount numeric not null,
  remarks text,
  effective_from date not null default current_date,
  created_at timestamptz default now()
);

alter table pt_slabs enable row level security;

create policy "pt_slabs_select" on pt_slabs for select using (is_management());

insert into pt_slabs (gender, min_gross, max_gross, pt_amount, remarks) values
  ('male',   0,     7500,  0,   null),
  ('male',   7501,  10000, 175, null),
  ('male',   10001, null,  200, 'In February deduct Rs.300 instead of Rs.200'),
  ('female', 0,     25000, 0,   null),
  ('female', 25001, null,  200, 'In February deduct Rs.300 instead of Rs.200');

-- ============================================================================
-- SECTION E — efficiency_incentive_slabs (new, seeded — Forge Shop only)
-- From the Union Agreement (01/09/23–31/03/2028) PDF read directly this
-- session. Only Forge Shop's table is confirmed; other worker departments'
-- agreements (if they have separate ones) are still unconfirmed — see
-- PENDING.md. Staff have no scheme (per Yash, mapped to monthly_scores
-- later, deferred ~3 months).
-- ============================================================================

create table efficiency_incentive_slabs (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  period_start date not null,
  period_end date not null,
  threshold_pct numeric not null,
  incentive_amount numeric not null,
  created_at timestamptz default now()
);

alter table efficiency_incentive_slabs enable row level security;

create policy "efficiency_incentive_slabs_select" on efficiency_incentive_slabs
  for select using (is_management());

insert into efficiency_incentive_slabs (department, period_start, period_end, threshold_pct, incentive_amount) values
  ('Forge Shop', '2025-09-01', '2026-08-31', 81, 1500),
  ('Forge Shop', '2025-09-01', '2026-08-31', 82, 1500),
  ('Forge Shop', '2025-09-01', '2026-08-31', 83, 2500),
  ('Forge Shop', '2025-09-01', '2026-08-31', 84, 3000),
  ('Forge Shop', '2025-09-01', '2026-08-31', 85, 3500);

-- ============================================================================
-- SECTION F — leave_requests: extend type CHECK for COFF / Outdoor Duty
-- Confirmed live categories (tracked through the same Leave_Applications
-- form as EL/CL/SL, via its own type field) — schema just didn't have room.
-- ============================================================================

alter table leave_requests drop constraint leave_requests_type_check;
alter table leave_requests add constraint leave_requests_type_check
  check (type in ('EL','CL','SL','LWP','COFF','OD'));

COMMIT;

-- Verify
select column_name from information_schema.columns where table_name = 'employee_salary_structure' order by ordinal_position;
select column_name from information_schema.columns where table_name = 'payroll_records' and column_name in
  ('working_days','present_days','el','cl','sl','ph','days_payable','ot_hours','canteen','society','mlwf','arrears','dispatch_incentive','other_allowance','production_efficiency_deduction','status','updated_at');
select * from pt_slabs order by gender, min_gross;
select * from efficiency_incentive_slabs order by threshold_pct;
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'leave_requests'::regclass and contype = 'c';
