-- ============================================================================
-- FORGE OS — Supabase / PostgreSQL schema
-- Varsha Forgings Pvt Ltd (VFPL) — Plant Intelligence System
--
-- Source: ForgeOS Master System Definition v1.0 (Aug 2026), Section 3
-- (Complete Workflow Library) and Section 6 (Core Data Model).
--
-- Run once, top to bottom, in the Supabase SQL Editor on a fresh project.
-- Idempotent: safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP
-- POLICY IF EXISTS throughout).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- SECTION A — ENUMS
-- ============================================================================

do $$ begin
  create type role_enum as enum (
    'owner', 'plant_head', 'manager', 'supervisor', 'member', 'hr_admin',
    'security_guard', 'ai_agent'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status_enum as enum ('P', 'LC', 'EC', 'OT', 'A', 'H', 'L', 'WO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type_enum as enum ('EL', 'CL', 'SL', 'CO', 'ML');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status_enum as enum (
    'pending', 'manager_approved', 'rejected', 'escalated_to_plant_head',
    'awaiting_owner_confirmation', 'approved'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_type_enum as enum ('morning', 'evening', 'night', 'general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type advance_safety_flag_enum as enum ('none', 'warning_over_30pct', 'auto_reject_over_50pct');
exception when duplicate_object then null; end $$;

do $$ begin
  create type advance_status_enum as enum (
    'pending', 'manager_approved', 'hr_reviewed', 'awaiting_owner_approval',
    'approved', 'rejected', 'auto_rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_type_enum as enum ('daily', 'weekly', 'assigned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status_enum as enum ('open', 'in_progress', 'done', 'overdue', 'escalated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_entry_type_enum as enum ('hourly', 'two_hourly', 'none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type validation_status_enum as enum ('pending', 'supervisor_validated', 'manager_validated', 'flagged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_direction_enum as enum ('inward', 'outward');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qc_status_enum as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status_enum as enum ('pending', 'matched', 'exception');
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_urgency_enum as enum ('customer_facing', 'internal', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type email_task_status_enum as enum ('pending', 'replied', 'escalated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mrm_status_enum as enum ('pending', 'submitted', 'reviewed', 'noted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fraud_flag_type_enum as enum ('bulk_confirmation', 'mock_location', 'gps_outside_radius');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fraud_flag_status_enum as enum ('open', 'reviewed', 'dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type regularisation_status_enum as enum ('pending', 'approved', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type warning_level_enum as enum ('warning_1', 'final_warning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type language_enum as enum ('en', 'hi');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- SECTION B — REFERENCE TABLES
-- ============================================================================

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_code text not null unique,
  is_production boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table departments is 'The 9 MRM departments: Production, Quality, Maintenance, Purchase & Stores, Design, Sales & Logistics, Accounts & Finance, HR, Administration.';

insert into departments (name, short_code, is_production) values
  ('Production', 'PROD', true),
  ('Quality', 'QLTY', true),
  ('Maintenance', 'MAINT', true),
  ('Purchase & Stores', 'PUR', false),
  ('Design', 'DSGN', false),
  ('Sales & Logistics', 'SALES', false),
  ('Accounts & Finance', 'ACCT', false),
  ('HR', 'HR', false),
  ('Administration', 'ADMIN', false)
on conflict (name) do nothing;

create table if not exists plant_config (
  config_key text primary key,
  config_value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into plant_config (config_key, config_value, description) values
  ('plant_code', '"VFL-AKT"', 'Plant identifier embedded in daily gate QR codes'),
  ('gps_lat', '19.8383935925407', 'Plant latitude'),
  ('gps_lng', '75.23638998304483', 'Plant longitude'),
  ('geofence_meters', '100', 'Check-in GPS geofence radius in metres'),
  ('late_grace_minutes', '30', 'Grace period before status becomes LC'),
  ('checkpoint2_window_minutes', '90', 'Security confirmation window from shift start'),
  ('bulk_confirmation_threshold', '{"count": 10, "seconds": 90}', 'Fraud threshold for supervisor Team-tab confirmations'),
  ('leave_coverage_warning_pct', '70', 'Dept coverage % below which a warning is shown before Approve'),
  ('leave_coverage_owner_confirm_pct', '50', 'Dept coverage % below which Owner confirmation is required'),
  ('leave_auto_escalate_hours', '48', 'Hours of no manager response before auto-escalation to Plant Head'),
  ('advance_warning_pct', '30', 'Advance as % of gross monthly salary that triggers a warning'),
  ('advance_auto_reject_pct', '50', 'Advance as % of gross monthly salary that triggers auto-reject'),
  ('advance_owner_approval_threshold', '10000', 'Advance amount (INR) above which Owner approval is required'),
  ('comp_off_expiry_days', '90', 'Days after which an earned comp-off expires'),
  ('regularisation_expiry_days', '7', 'Days before a pending regularisation auto-expires'),
  ('mrm_reminder_start_day', '8', 'Day of month MRM reminders begin'),
  ('mrm_due_day', '10', 'Day of month MRM submissions are due, 17:00'),
  ('email_deadline_hours', '{"customer_facing": 2, "internal": 4, "other": 8}', 'Email task deadline hours by urgency'),
  ('pf_rate_pct', '12', 'Employee PF contribution rate'),
  ('esic_rate_pct', '0.75', 'Employee ESIC contribution rate, applies if gross <= esic_gross_ceiling'),
  ('esic_gross_ceiling', '21000', 'Gross salary ceiling for ESIC applicability'),
  ('pt_amount', '200', 'Professional Tax flat monthly amount'),
  ('mlwf_amount', '25', 'Maharashtra Labour Welfare Fund flat amount'),
  ('nightly_scoring_time_ist', '"22:00"', 'Time the nightly-scoring edge function runs'),
  ('shift_start_times', '{"morning": "06:00", "evening": "14:00", "night": "22:00", "general": "09:00"}', 'Shift start times (IST, 24h) used by shift-reminder'),
  ('score_weights', '{
    "member": {"attendance": 30, "ontime": 10, "task": 20, "kpi": 20, "production": 20, "team_control": 0},
    "operator": {"attendance": 20, "ontime": 10, "task": 10, "kpi": 20, "production": 30, "team_control": 10},
    "supervisor": {"attendance": 25, "ontime": 10, "task": 25, "kpi": 30, "production": 0, "team_control": 10},
    "manager": {"attendance": 20, "ontime": 10, "task": 25, "kpi": 35, "production": 0, "team_control": 10}
  }', 'Role-weighted score component weights, Workflow 7 step 3')
on conflict (config_key) do nothing;

create table if not exists public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  year int not null,
  applicable_departments text[] not null default '{}', -- empty = all departments
  created_at timestamptz not null default now(),
  unique (holiday_date)
);

create table if not exists role_kras (
  id uuid primary key default gen_random_uuid(),
  role role_enum not null,
  kra_title text not null,
  weightage numeric(5,2) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists role_kpis (
  id uuid primary key default gen_random_uuid(),
  role role_enum not null,
  kpi_title text not null,
  target text,
  weightage numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists part_master (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null,
  machine_name text not null,
  part_number text not null,
  part_name text,
  cycle_time_seconds numeric(10,2) not null,
  department_id uuid references departments(id),
  created_at timestamptz not null default now(),
  unique (machine_id, part_number)
);

-- ============================================================================
-- SECTION C — EMPLOYEES
-- ============================================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_code text not null unique, -- e.g. VFL1001
  full_name text not null,
  full_name_hi text,
  phone text not null unique,
  role role_enum not null,
  department_id uuid references departments(id),
  designation text,
  reporting_manager_id uuid references employees(id),
  date_of_joining date,
  probation_end_date date,
  date_of_birth date,
  gender text,
  address text,
  bank_account_number text,
  bank_ifsc text,
  bank_name text,
  pf_number text,
  uan text,
  esic_number text,
  pan text,
  aadhaar_last4 text,
  salary_structure jsonb not null default '{}', -- basic, hra, conveyance, washing, education, vda, heat, dispatch_incentive, production_allowance
  language_pref language_enum not null default 'hi',
  avatar_url text,
  is_active boolean not null default false,
  activated_at timestamptz,
  deactivated_at timestamptz,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_department on employees(department_id);
create index if not exists idx_employees_role on employees(role);
create index if not exists idx_employees_manager on employees(reporting_manager_id);
create index if not exists idx_employees_active on employees(is_active);

-- Seed the AI agent employee row (Section 1, Module 10 — Varsha AI, AI001, hr_admin role)
insert into employees (employee_code, full_name, full_name_hi, phone, role, is_active, activated_at)
values ('AI001', 'Varsha AI', 'वर्षा एआई', '0000000000', 'hr_admin', true, now())
on conflict (employee_code) do nothing;

-- ============================================================================
-- SECTION D — ATTENDANCE (Workflow 1, Workflow 10, Workflow 11)
-- ============================================================================

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  shift_date date not null,
  shift_type shift_type_enum not null default 'general',
  status attendance_status_enum not null default 'A',

  -- checkpoint 1: self check-in
  checkpoint1_at timestamptz,
  checkpoint1_gps_lat double precision,
  checkpoint1_gps_lng double precision,
  checkpoint1_distance_meters numeric(10,2),
  checkpoint1_qr_code text,
  mock_location_detected boolean not null default false,

  -- checkpoint 2: security gate confirmation
  checkpoint2_at timestamptz,
  checkpoint2_confirmed_by uuid references employees(id),

  -- checkpoint 3: supervisor floor confirmation
  checkpoint3_at timestamptz,
  checkpoint3_confirmed_by uuid references employees(id),

  late_minutes int not null default 0,
  late_reason text, -- Traffic / Health / Family / Vehicle / Other
  is_regularised boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_date)
);

create index if not exists idx_attendance_employee_date on attendance(employee_id, shift_date);
create index if not exists idx_attendance_date on attendance(shift_date);
create index if not exists idx_attendance_status on attendance(status);

create table if not exists attendance_warnings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  warning_level warning_level_enum not null,
  reason text not null,
  month int not null,
  year int not null,
  acknowledged boolean not null default false,
  acknowledged_at timestamptz,
  requires_owner_approval boolean not null default false,
  owner_approved boolean,
  owner_approved_by uuid references employees(id),
  owner_approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists attendance_regularisation (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  attendance_date date not null,
  requested_status attendance_status_enum not null,
  reason text not null,
  shift_worked shift_type_enum,
  status regularisation_status_enum not null default 'pending',
  reporting_manager_id uuid references employees(id),
  action_at timestamptz,
  action_reason text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table if not exists fraud_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type fraud_flag_type_enum not null,
  supervisor_id uuid references employees(id),
  employee_id uuid references employees(id),
  confirmations_count int,
  seconds_elapsed numeric(10,2),
  details jsonb not null default '{}',
  status fraud_flag_status_enum not null default 'open',
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_fraud_flags_supervisor on fraud_flags(supervisor_id);

-- ============================================================================
-- SECTION E — SHIFTS
-- ============================================================================

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  shift_date date not null,
  shift_type shift_type_enum not null,
  assigned_by uuid references employees(id),
  created_at timestamptz not null default now(),
  unique (employee_id, shift_date)
);

create index if not exists idx_shifts_date on shifts(shift_date);

-- ============================================================================
-- SECTION F — LEAVE AND ADVANCE (Workflow 2, Workflow 4)
-- ============================================================================

create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  year int not null,
  el_balance numeric(5,2) not null default 12,
  cl_balance numeric(5,2) not null default 8,
  sl_balance numeric(5,2) not null default 6,
  updated_at timestamptz not null default now(),
  unique (employee_id, year)
);

create table if not exists comp_off_balance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  earned_date date not null,
  expiry_date date not null,
  reason text,
  is_used boolean not null default false,
  used_in_leave_request_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  leave_type leave_type_enum not null,
  start_date date not null,
  end_date date not null,
  days_count numeric(5,2) not null,
  reason text,
  status leave_status_enum not null default 'pending',
  coverage_pct_at_request numeric(5,2),
  coverage_warning_shown boolean not null default false,
  owner_confirmation_required boolean not null default false,

  reporting_manager_id uuid references employees(id),
  manager_action text, -- approved / rejected
  manager_action_at timestamptz,
  manager_action_reason text,

  plant_head_action text, -- approved / rejected -- FINAL approver for all leave
  plant_head_action_at timestamptz,
  plant_head_action_reason text,

  owner_confirmed_by uuid references employees(id),
  owner_confirmed_at timestamptz,

  escalated_at timestamptz, -- 48h auto-escalation
  comp_off_balance_id uuid references comp_off_balance(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leave_requests_employee on leave_requests(employee_id);
create index if not exists idx_leave_requests_status on leave_requests(status);

alter table comp_off_balance
  add constraint fk_comp_off_leave_request
  foreign key (used_in_leave_request_id) references leave_requests(id) on delete set null;

create table if not exists salary_advances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  amount numeric(12,2) not null,
  repayment_months int not null check (repayment_months in (3, 6, 12)),
  reason text,
  monthly_deduction numeric(12,2),
  outstanding_balance numeric(12,2),
  pct_of_gross numeric(5,2),
  safety_flag advance_safety_flag_enum not null default 'none',

  reporting_manager_action text,
  reporting_manager_action_at timestamptz,
  hr_admin_action text,
  hr_admin_action_at timestamptz,
  hr_admin_override boolean not null default false,
  owner_action text, -- required if amount > threshold
  owner_action_at timestamptz,

  status advance_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salary_advances_employee on salary_advances(employee_id);

-- ============================================================================
-- SECTION G — PRODUCTION (Workflow 5)
-- ============================================================================

create table if not exists hourly_production (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  department_id uuid references departments(id),
  machine_id text not null,
  part_master_id uuid references part_master(id),
  shift_date date not null,
  shift_type shift_type_enum not null,
  hour_slot int not null, -- 1..N within shift
  parts_made int not null default 0,
  entry_type production_entry_type_enum not null default 'hourly',
  target_parts numeric(10,2),
  efficiency_pct numeric(6,2),

  status validation_status_enum not null default 'pending',
  supervisor_validated_by uuid references employees(id),
  supervisor_validated_at timestamptz,
  manager_validated_by uuid references employees(id),
  manager_validated_at timestamptz,
  incentive_flag boolean not null default false, -- efficiency > 100%
  alert_flag boolean not null default false, -- efficiency < 80%
  points_awarded numeric(6,2) not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists idx_hourly_production_employee_date on hourly_production(employee_id, shift_date);

create table if not exists maintenance_observations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  department_id uuid references departments(id),
  shift_date date not null,
  shift_type shift_type_enum not null,
  observation_type text not null, -- electricity / oil / general
  electricity_start_reading numeric(12,2),
  electricity_end_reading numeric(12,2),
  oil_machine text,
  oil_type text,
  oil_qty numeric(10,2),
  notes text,
  urgency text, -- low / medium / high
  points_awarded numeric(6,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists casual_workers (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references employees(id),
  department_id uuid references departments(id),
  shift_date date not null,
  shift_type shift_type_enum not null,
  unskilled_count int not null default 0,
  skilled_count int not null default 0,
  operator_count int not null default 0,
  unskilled_rate numeric(10,2),
  skilled_rate numeric(10,2),
  operator_rate numeric(10,2),
  created_at timestamptz not null default now(),
  unique (supervisor_id, department_id, shift_date, shift_type)
);

create table if not exists shift_reports (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references employees(id),
  department_id uuid references departments(id),
  shift_date date not null,
  shift_type shift_type_enum not null,
  summary text,
  issues text,
  submitted_at timestamptz not null default now(),
  points_awarded numeric(6,2) not null default 0,
  unique (supervisor_id, department_id, shift_date, shift_type)
);

-- ============================================================================
-- SECTION H — SCORING (Workflow 7)
-- ============================================================================

create table if not exists monthly_scores (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  year int not null,
  month int not null,

  attendance_score numeric(6,2) not null default 0,
  ontime_score numeric(6,2) not null default 0,
  task_score numeric(6,2) not null default 0,
  kpi_score numeric(6,2) not null default 0,
  production_score numeric(6,2) not null default 0,
  team_control_score numeric(6,2) not null default 0,
  brownie_points numeric(6,2) not null default 0,
  composite_score numeric(6,2) not null default 0,

  eotm_category text, -- best_member / best_operator / best_supervisor / best_manager
  eotm_rank int,
  eotm_gap_to_leader numeric(6,2),
  eotm_winner boolean not null default false,

  badge text, -- bronze / silver / gold / eotm_winner
  ai_suggestion text,
  ai_suggestion_generated_at timestamptz,

  computed_at timestamptz not null default now(),
  unique (employee_id, year, month)
);

create index if not exists idx_monthly_scores_period on monthly_scores(year, month);
create index if not exists idx_monthly_scores_composite on monthly_scores(composite_score desc);

-- ============================================================================
-- SECTION I — TASKS AND NOTIFICATIONS (Module 8)
-- ============================================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_by uuid not null references employees(id),
  assigned_to uuid not null references employees(id),
  task_type task_type_enum not null default 'assigned',
  points numeric(6,2) not null default 0,
  priority text not null default 'normal', -- low / normal / high
  due_date date,
  status task_status_enum not null default 'open',
  escalation_level int not null default 0, -- 0 none, 1 = 7+ days overdue -> plant head + owner
  escalated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_assigned_to on tasks(assigned_to);
create index if not exists idx_tasks_status_due on tasks(status, due_date);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_employee_unread on notifications(employee_id, is_read);

create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  expo_push_token text not null unique,
  device_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_employee on push_tokens(employee_id);

-- ============================================================================
-- SECTION J — 5S CHALLENGE
-- ============================================================================

create table if not exists five_s_challenges (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id),
  shift_type shift_type_enum,
  challenge_date date not null,
  challenge_text_en text not null,
  challenge_text_hi text not null,
  category text not null, -- sort / set_in_order / shine / standardize / sustain
  points numeric(6,2) not null default 5,
  created_at timestamptz not null default now(),
  unique (department_id, challenge_date)
);

create table if not exists five_s_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references five_s_challenges(id),
  employee_id uuid not null references employees(id),
  photo_url text,
  completed_at timestamptz not null default now(),
  points_awarded numeric(6,2) not null default 0,
  unique (challenge_id, employee_id)
);

-- ============================================================================
-- SECTION K — MRM MONTHLY REVIEW (Workflow 8)
-- ============================================================================

create table if not exists mrm_reviews (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  year int not null,
  month int not null,
  submitted_by uuid references employees(id),
  kpi_achievements text,
  highlights text,
  challenges text,
  action_items text,
  manpower_status text,
  status mrm_status_enum not null default 'pending',
  submitted_at timestamptz,
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  review_notes text,
  noted_by uuid references employees(id),
  noted_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (department_id, year, month)
);

-- ============================================================================
-- SECTION L — PROCUREMENT AND OPERATIONS (Workflow 6)
-- ============================================================================

create table if not exists purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id),
  raised_by uuid not null references employees(id),
  item text not null,
  qty numeric(12,2) not null,
  uom text,
  urgency text not null default 'normal',
  required_by_date date,
  status text not null default 'open', -- open / po_created / cancelled
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid references purchase_requisitions(id),
  vendor_name text not null,
  unit_price numeric(12,2) not null,
  qty numeric(12,2) not null,
  expected_delivery_date date,
  created_by uuid references employees(id),
  status text not null default 'open', -- open / delivered / cancelled — 48h creation SLA enforced in app/edge logic
  created_at timestamptz not null default now()
);

create table if not exists vehicle_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text not null,
  driver_name text,
  vendor_name text,
  material text,
  direction vehicle_direction_enum not null,
  logged_by uuid not null references employees(id),
  time_in timestamptz,
  time_out timestamptz,
  purpose text,
  linked_grn_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists goods_receipt_notes (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references purchase_orders(id),
  vehicle_log_id uuid references vehicle_log(id),
  received_qty numeric(12,2) not null,
  condition text,
  challan_number text,
  qc_status qc_status_enum not null default 'pending',
  qc_notes text,
  qc_by uuid references employees(id),
  raised_by uuid not null references employees(id),
  created_at timestamptz not null default now()
);

alter table vehicle_log
  add constraint fk_vehicle_log_grn
  foreign key (linked_grn_id) references goods_receipt_notes(id) on delete set null;

create table if not exists three_way_match (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references purchase_orders(id),
  grn_id uuid not null references goods_receipt_notes(id),
  po_price numeric(12,2) not null,
  invoice_price numeric(12,2) not null,
  grn_qty numeric(12,2) not null,
  invoice_qty numeric(12,2) not null,
  qc_status qc_status_enum not null,
  match_status match_status_enum not null default 'pending',
  checked_by uuid references employees(id),
  payment_released boolean not null default false,
  payment_released_by uuid references employees(id),
  payment_released_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SECTION M — EMAIL TASKS (Workflow 9, Module 8)
-- ============================================================================

create table if not exists gmail_inbox_owners (
  id uuid primary key default gen_random_uuid(),
  inbox_email text not null unique,
  owner_employee_id uuid references employees(id),
  urgency_keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists email_tasks (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique,
  inbox_email text not null,
  assigned_to uuid references employees(id),
  subject text,
  snippet text,
  urgency email_urgency_enum not null default 'internal',
  deadline_at timestamptz,
  status email_task_status_enum not null default 'pending',
  replied_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_tasks_assigned on email_tasks(assigned_to, status);

-- ============================================================================
-- SECTION N — AI AGENT AUDIT LOG (Module 10)
-- ============================================================================

create table if not exists ai_agent_log (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  description text not null,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- SECTION O — HELPER FUNCTIONS (used by RLS policies)
-- ============================================================================

create or replace function auth_employee_id()
returns uuid
language sql stable
as $$
  select id from employees where auth_user_id = auth.uid();
$$;

create or replace function auth_role()
returns role_enum
language sql stable
as $$
  select role from employees where auth_user_id = auth.uid();
$$;

create or replace function auth_department_id()
returns uuid
language sql stable
as $$
  select department_id from employees where auth_user_id = auth.uid();
$$;

create or replace function auth_is_management()
returns boolean
language sql stable
as $$
  select auth_role() in ('owner', 'plant_head', 'hr_admin');
$$;

create or replace function auth_is_dept_lead()
returns boolean
language sql stable
as $$
  select auth_role() in ('manager', 'supervisor');
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['employees', 'attendance', 'leave_requests', 'salary_advances', 'push_tokens']
  loop
    execute format('drop trigger if exists trg_set_updated_at on %I;', t);
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- SECTION P — ROW LEVEL SECURITY
-- ============================================================================

alter table employees enable row level security;
alter table attendance enable row level security;
alter table attendance_warnings enable row level security;
alter table attendance_regularisation enable row level security;
alter table fraud_flags enable row level security;
alter table shifts enable row level security;
alter table leave_balances enable row level security;
alter table comp_off_balance enable row level security;
alter table leave_requests enable row level security;
alter table salary_advances enable row level security;
alter table hourly_production enable row level security;
alter table maintenance_observations enable row level security;
alter table casual_workers enable row level security;
alter table shift_reports enable row level security;
alter table monthly_scores enable row level security;
alter table tasks enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;
alter table five_s_challenges enable row level security;
alter table five_s_challenge_completions enable row level security;
alter table mrm_reviews enable row level security;
alter table purchase_requisitions enable row level security;
alter table purchase_orders enable row level security;
alter table vehicle_log enable row level security;
alter table goods_receipt_notes enable row level security;
alter table three_way_match enable row level security;
alter table email_tasks enable row level security;
alter table gmail_inbox_owners enable row level security;
alter table ai_agent_log enable row level security;
alter table departments enable row level security;
alter table plant_config enable row level security;
alter table public_holidays enable row level security;
alter table role_kras enable row level security;
alter table role_kpis enable row level security;
alter table part_master enable row level security;

-- Reference data: readable by every authenticated employee
drop policy if exists "reference read all" on departments;
create policy "reference read all" on departments for select using (auth.role() = 'authenticated');
drop policy if exists "reference read all" on plant_config;
create policy "reference read all" on plant_config for select using (auth.role() = 'authenticated');
drop policy if exists "reference read all" on public_holidays;
create policy "reference read all" on public_holidays for select using (auth.role() = 'authenticated');
drop policy if exists "reference read all" on role_kras;
create policy "reference read all" on role_kras for select using (auth.role() = 'authenticated');
drop policy if exists "reference read all" on role_kpis;
create policy "reference read all" on role_kpis for select using (auth.role() = 'authenticated');
drop policy if exists "reference read all" on part_master;
create policy "reference read all" on part_master for select using (auth.role() = 'authenticated');

-- employees: self read/update; management full read; dept leads read own dept
drop policy if exists "employees self select" on employees;
create policy "employees self select" on employees for select
  using (auth_user_id = auth.uid() or auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()));
drop policy if exists "employees self update" on employees;
create policy "employees self update" on employees for update
  using (auth_user_id = auth.uid() or auth_is_management());
drop policy if exists "employees management write" on employees;
create policy "employees management write" on employees for insert
  with check (auth_is_management());

-- attendance: own rows; dept leads see dept; management sees all
drop policy if exists "attendance select" on attendance;
create policy "attendance select" on attendance for select
  using (
    employee_id = auth_employee_id()
    or auth_is_management()
    or (auth_is_dept_lead() and employee_id in (select id from employees where department_id = auth_department_id()))
    or auth_role() = 'security_guard'
  );
drop policy if exists "attendance insert own" on attendance;
create policy "attendance insert own" on attendance for insert
  with check (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead() or auth_role() = 'security_guard');
drop policy if exists "attendance update checkpoint" on attendance;
create policy "attendance update checkpoint" on attendance for update
  using (
    employee_id = auth_employee_id()
    or auth_is_management()
    or auth_is_dept_lead()
    or auth_role() = 'security_guard'
  );

-- Generic pattern applied to the remaining operational tables:
-- self (employee_id) OR department scope (dept leads) OR management (full)

drop policy if exists "leave_requests access" on leave_requests;
create policy "leave_requests access" on leave_requests for all
  using (
    employee_id = auth_employee_id()
    or reporting_manager_id = auth_employee_id()
    or auth_is_management()
    or (auth_is_dept_lead() and employee_id in (select id from employees where department_id = auth_department_id()))
  )
  with check (
    employee_id = auth_employee_id()
    or reporting_manager_id = auth_employee_id()
    or auth_is_management()
    or auth_is_dept_lead()
  );

drop policy if exists "leave_balances select" on leave_balances;
create policy "leave_balances select" on leave_balances for select
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "comp_off select" on comp_off_balance;
create policy "comp_off select" on comp_off_balance for select
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "salary_advances access" on salary_advances;
create policy "salary_advances access" on salary_advances for all
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead())
  with check (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "hourly_production access" on hourly_production;
create policy "hourly_production access" on hourly_production for all
  using (
    employee_id = auth_employee_id()
    or auth_is_management()
    or (auth_is_dept_lead() and department_id = auth_department_id())
  )
  with check (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "maintenance_observations access" on maintenance_observations;
create policy "maintenance_observations access" on maintenance_observations for all
  using (employee_id = auth_employee_id() or auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()))
  with check (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "casual_workers access" on casual_workers;
create policy "casual_workers access" on casual_workers for all
  using (supervisor_id = auth_employee_id() or auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()))
  with check (supervisor_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "shift_reports access" on shift_reports;
create policy "shift_reports access" on shift_reports for all
  using (supervisor_id = auth_employee_id() or auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()))
  with check (supervisor_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "monthly_scores select" on monthly_scores;
create policy "monthly_scores select" on monthly_scores for select
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "tasks access" on tasks;
create policy "tasks access" on tasks for all
  using (assigned_to = auth_employee_id() or assigned_by = auth_employee_id() or auth_is_management())
  with check (assigned_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "notifications self" on notifications;
create policy "notifications self" on notifications for all
  using (employee_id = auth_employee_id() or auth_is_management())
  with check (true);

drop policy if exists "push_tokens self" on push_tokens;
create policy "push_tokens self" on push_tokens for all
  using (employee_id = auth_employee_id() or auth_is_management())
  with check (employee_id = auth_employee_id() or auth_is_management());

drop policy if exists "five_s_challenges read" on five_s_challenges;
create policy "five_s_challenges read" on five_s_challenges for select using (auth.role() = 'authenticated');
drop policy if exists "five_s_completions access" on five_s_challenge_completions;
create policy "five_s_completions access" on five_s_challenge_completions for all
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead())
  with check (employee_id = auth_employee_id() or auth_is_management());

drop policy if exists "mrm_reviews access" on mrm_reviews;
create policy "mrm_reviews access" on mrm_reviews for all
  using (auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()))
  with check (auth_is_management() or (auth_is_dept_lead() and department_id = auth_department_id()));

drop policy if exists "purchase_requisitions access" on purchase_requisitions;
create policy "purchase_requisitions access" on purchase_requisitions for all
  using (raised_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead())
  with check (raised_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "purchase_orders access" on purchase_orders;
create policy "purchase_orders access" on purchase_orders for all
  using (auth_is_management() or auth_is_dept_lead())
  with check (auth_is_management() or auth_is_dept_lead());

drop policy if exists "vehicle_log access" on vehicle_log;
create policy "vehicle_log access" on vehicle_log for all
  using (logged_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead() or auth_role() = 'security_guard')
  with check (logged_by = auth_employee_id() or auth_is_management() or auth_role() = 'security_guard');

drop policy if exists "grn access" on goods_receipt_notes;
create policy "grn access" on goods_receipt_notes for all
  using (raised_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead())
  with check (raised_by = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "three_way_match access" on three_way_match;
create policy "three_way_match access" on three_way_match for all
  using (auth_is_management() or auth_is_dept_lead())
  with check (auth_is_management() or auth_is_dept_lead());

drop policy if exists "email_tasks access" on email_tasks;
create policy "email_tasks access" on email_tasks for all
  using (assigned_to = auth_employee_id() or auth_is_management())
  with check (auth_is_management());

drop policy if exists "gmail_inbox_owners read" on gmail_inbox_owners;
create policy "gmail_inbox_owners read" on gmail_inbox_owners for select using (auth_is_management());

drop policy if exists "attendance_warnings select" on attendance_warnings;
create policy "attendance_warnings select" on attendance_warnings for select
  using (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "attendance_regularisation access" on attendance_regularisation;
create policy "attendance_regularisation access" on attendance_regularisation for all
  using (employee_id = auth_employee_id() or reporting_manager_id = auth_employee_id() or auth_is_management())
  with check (employee_id = auth_employee_id() or auth_is_management() or auth_is_dept_lead());

drop policy if exists "fraud_flags select" on fraud_flags;
create policy "fraud_flags select" on fraud_flags for select using (auth_is_management());

drop policy if exists "ai_agent_log select" on ai_agent_log;
create policy "ai_agent_log select" on ai_agent_log for select using (auth_is_management());

-- Service role (used by all edge functions) bypasses RLS automatically —
-- no additional policy needed for supabase_service_role.

-- ============================================================================
-- End of schema.
-- ============================================================================
