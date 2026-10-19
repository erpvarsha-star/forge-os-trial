-- PATCH_91 — Monthly payroll input feeds: canteen, efficiency, society, adjustments.
-- ADDITIVE ONLY. Mirrors the HR OS INPUT_* tab schemas 1:1 so history and habits carry over.
-- Advances are NOT duplicated here: the existing advance_requests/salary_advances tables
-- remain the source; the runner reads approved rows for the period.
-- Engine counts ONLY rows with approval_status = 'approved'.

-- Canteen (HR OS INPUT_CANTEEN) ---------------------------------------------
create table if not exists payroll_canteen_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_month text not null,             -- 'YYYY-MM' e.g. '2026-10'
  employee_id uuid not null references employees(id),
  amount_inr numeric(10,2) not null check (amount_inr >= 0),
  source text default 'app',               -- 'app' | 'import' | 'sheet-migration'
  source_ref text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  remarks text,
  entered_by uuid references employees(id),
  entered_at timestamptz not null default now(),
  unique (payroll_month, employee_id)      -- one canteen charge per employee per month
);

-- Efficiency (HR OS INPUT_EFFICIENCY) -----------------------------------------
create table if not exists payroll_efficiency_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_month text not null,
  employee_id uuid references employees(id),  -- null = plant-wide default for the month
  efficiency_pct numeric(5,2) not null check (efficiency_pct >= 0 and efficiency_pct <= 150),
  physical_present_days_override numeric(4,1),
  source text default 'app',
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  note text,
  entered_by uuid references employees(id),
  entered_at timestamptz not null default now()
);

-- Society recovery (HR OS INPUT_SOCIETY) --------------------------------------
create table if not exists payroll_society_recoveries (
  id uuid primary key default gen_random_uuid(),
  payroll_month text not null,
  employee_id uuid not null references employees(id),
  society_name text,
  loan_reference text,
  general_emi_inr numeric(10,2) default 0,
  emergency_emi_inr numeric(10,2) default 0,
  education_emi_inr numeric(10,2) default 0,
  shares_other_inr numeric(10,2) default 0,
  total_recovery_inr numeric(10,2) generated always as
    (coalesce(general_emi_inr,0)+coalesce(emergency_emi_inr,0)
    +coalesce(education_emi_inr,0)+coalesce(shares_other_inr,0)) stored,
  outstanding_balance_inr numeric(12,2),
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  remarks text,
  entered_by uuid references employees(id),
  entered_at timestamptz not null default now(),
  unique (payroll_month, employee_id, society_name)
);

-- Adjustments (HR OS INPUT_ADJUSTMENTS) — arrears, incentives, other ± amounts --
create table if not exists payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_month text not null,
  employee_id uuid not null references employees(id),
  adjustment_type text not null,           -- ARREARS | DISPATCH_INCENTIVE | OTHER_ALLOWANCE | OTHER_DEDUCTION | ENCASHMENT
  signed_amount_inr numeric(12,2) not null,  -- + earning, - deduction
  reason text not null,
  source_reference text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  reversal_of uuid references payroll_adjustments(id),
  entered_by uuid references employees(id),
  entered_at timestamptz not null default now()
);

-- RLS: management-only. Employees never see feed entries directly (they see
-- results on their payslip after finalize, via pay_run_items policies).
alter table payroll_canteen_entries enable row level security;
alter table payroll_efficiency_entries enable row level security;
alter table payroll_society_recoveries enable row level security;
alter table payroll_adjustments enable row level security;
create policy canteen_mgmt on payroll_canteen_entries for all using (is_management());
create policy efficiency_mgmt on payroll_efficiency_entries for all using (is_management());
create policy society_mgmt on payroll_society_recoveries for all using (is_management());
create policy adjustments_mgmt on payroll_adjustments for all using (is_management());

-- Audit every feed change:
drop trigger if exists trg_audit_canteen on payroll_canteen_entries;
create trigger trg_audit_canteen after insert or update or delete on payroll_canteen_entries
  for each row execute function audit_row_change();
drop trigger if exists trg_audit_efficiency on payroll_efficiency_entries;
create trigger trg_audit_efficiency after insert or update or delete on payroll_efficiency_entries
  for each row execute function audit_row_change();
drop trigger if exists trg_audit_society on payroll_society_recoveries;
create trigger trg_audit_society after insert or update or delete on payroll_society_recoveries
  for each row execute function audit_row_change();
drop trigger if exists trg_audit_adjustments on payroll_adjustments;
create trigger trg_audit_adjustments after insert or update or delete on payroll_adjustments
  for each row execute function audit_row_change();
