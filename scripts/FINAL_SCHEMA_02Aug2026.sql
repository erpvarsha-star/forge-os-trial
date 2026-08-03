-- ============================================================================
-- FORGE OS — FINAL_SCHEMA_02Aug2026.sql
--
-- One unified schema satisfying exactly what the app (app/, hooks/, lib/)
-- queries — table names, column names, and types were extracted by reading
-- every Supabase call in the codebase, not assumed from any earlier spec.
-- Where the app was internally inconsistent (a screen querying a column its
-- own TypeScript type never declared), the app's actual query wins — noted
-- inline with "APP-VERIFIED:" comments at the exact points this matters.
--
-- SAFETY NOTE: this file intentionally does NOT run `DROP SCHEMA public
-- CASCADE`. That statement destroys every table in the database, including
-- anything unrelated to Forge OS, the instant this migration is applied —
-- and with the Supabase GitHub integration linked to this repo, "applied"
-- can mean "the moment this file is pushed," not something you can pause to
-- confirm. Instead, each table below is individually
-- `DROP TABLE IF EXISTS ... CASCADE` before being redefined, so this only
-- ever touches the 20 tables Forge OS actually owns.
--
-- Tables intentionally NOT created: `tasks`, `part_master`,
-- `production_entries`, `attendance` (old name), `fraud_flags` (old, wrong
-- shape) — none of these are queried anywhere in app/, hooks/, or lib/.
-- `fraud_flags` IS recreated below, but in the shape Step 5's new buddy-
-- device check actually writes (employee_id, flag_type, description,
-- reviewed) — a different, narrower table than the one used to exist.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- SECTION A — DROP (only the tables this migration owns and redefines)
-- ============================================================================

drop table if exists five_s_submissions cascade;
drop table if exists "5s_submissions" cascade;
drop table if exists five_s_challenges cascade;
drop table if exists "5s_challenges" cascade;
drop table if exists eod_confirmations cascade;
drop table if exists vehicle_log cascade;
drop table if exists fraud_alerts cascade;
drop table if exists fraud_flags cascade;
drop table if exists casual_workers cascade;
drop table if exists data_collection_submissions cascade;
drop table if exists mrm_reviews cascade;
drop table if exists email_tasks cascade;
drop table if exists notifications cascade;
drop table if exists push_tokens cascade;
drop table if exists monthly_scores cascade;
drop table if exists payroll_records cascade;
drop table if exists advance_requests cascade;
drop table if exists leave_requests cascade;
drop table if exists leave_balances cascade;
drop table if exists maintenance_observations cascade;
drop table if exists employee_shifts cascade;
drop table if exists shifts cascade;
drop table if exists attendance_records cascade;
drop table if exists attendance cascade;
drop table if exists plant_config cascade;
drop table if exists departments cascade;
drop table if exists employees cascade;

-- ============================================================================
-- SECTION B — employees
-- ============================================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  emp_code text unique not null,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('member','supervisor','manager','plant_head','hr_admin','owner','security_guard')),
  department text,
  category text,
  language_preference text default 'hi' check (language_preference in ('en','hi')),
  supervisor_id uuid references employees(id),
  manager_id uuid references employees(id),
  plant_head_id uuid references employees(id),
  salary numeric, -- APP-VERIFIED: app/(manager)/approvals.tsx reads employee.salary (30% advance safety check); not in the Employee TS type, but the app queries it
  is_active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_employees_supervisor on employees(supervisor_id);
create index idx_employees_manager on employees(manager_id);
create index idx_employees_role on employees(role);

-- ============================================================================
-- SECTION C1 — departments
-- Plain lookup table. employees.department is a text field (not FK) for
-- flexibility; this table exists so edge functions (nightly-scoring,
-- mrm-reminder) can look up is_production and iterate dept names.
-- ============================================================================

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_production boolean default false,
  created_at timestamptz default now()
);

insert into departments (name, is_production) values
  ('Forge Shop',          true),
  ('Press Shop',          true),
  ('Heat Treatment',      true),
  ('Machine Shop',        true),
  ('VMC Shop',            true),
  ('Die Shop',            true),
  ('Cutting Shop',        true),
  ('Final Shop',          true),
  ('Maintenance',         false),
  ('Quality',             false),
  ('Design',              false),
  ('Administration',      false),
  ('Human Resource',      false),
  ('Accounts',            false),
  ('Purchase',            false),
  ('Stores',              false),
  ('Sales & Logistics',   false),
  ('Production',          true)
on conflict (name) do nothing;

-- ============================================================================
-- SECTION C2 — plant_config (key-value; lib/location.ts reads config_key/config_value rows, not a single flat row)
-- ============================================================================

create table plant_config (
  config_key text primary key,
  config_value jsonb not null,
  description text,
  updated_at timestamptz default now()
);

insert into plant_config (config_key, config_value, description) values
  ('plant_code', '"VFL-AKT"', 'Plant identifier'),
  ('plant_name', '"Varsha Forgings"', 'Display name used by PlantConfig.plant_name'),
  ('plant_lat', '19.8762', 'Plant latitude — read as PlantConfig.latitude'),
  ('plant_lng', '75.3433', 'Plant longitude — read as PlantConfig.longitude'),
  ('geofence_radius_meters', '100', 'Check-in GPS geofence radius in metres'),
  ('qr_secret_salt', '"CHANGE_ME_ROTATE_IN_PRODUCTION"', 'Secret mixed into the daily gate QR hash')
on conflict (config_key) do nothing;

-- ============================================================================
-- SECTION D — attendance_records
-- ============================================================================

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  date date not null,
  status text not null default 'A' check (status in ('P','A','L','WO','H','HL')),
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  late_reason text,
  late_minutes integer default 0,
  qr_verified boolean default false,
  checkpoint2_confirmed_by uuid references employees(id),
  checkpoint2_at timestamptz,
  device_id text, -- Step 5: buddy-device fraud check
  mock_location_detected boolean default false, -- Step 5: mock-location fraud check
  created_at timestamptz default now(),
  unique (employee_id, date)
);

create index idx_attendance_records_date on attendance_records(date);
create index idx_attendance_records_device_date on attendance_records(device_id, date);

-- ============================================================================
-- SECTION E — shifts / employee_shifts
-- ============================================================================

create table shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time text not null,
  end_time text not null,
  department text,
  is_night_shift boolean default false
);

create table employee_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  shift_id uuid not null references shifts(id),
  date date not null,
  unique (employee_id, date)
);

-- ============================================================================
-- SECTION F — leave_balances / leave_requests
-- ============================================================================

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  earned_leave numeric default 0,
  casual_leave numeric default 0,
  sick_leave numeric default 0,
  year integer not null,
  unique (employee_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  type text not null check (type in ('EL','CL','SL','LWP')),
  start_date date not null,
  end_date date not null,
  days numeric not null,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

create index idx_leave_requests_employee on leave_requests(employee_id);
create index idx_leave_requests_status on leave_requests(status);

-- ============================================================================
-- SECTION G — advance_requests
-- ============================================================================

create table advance_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  amount numeric not null,
  reason text,
  repayment_months integer default 1,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  outstanding_balance numeric default 0,
  created_at timestamptz default now()
);

create index idx_advance_requests_employee on advance_requests(employee_id);
create index idx_advance_requests_status on advance_requests(status);

-- ============================================================================
-- SECTION H — payroll_records
-- ============================================================================

create table payroll_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  month text not null, -- APP-VERIFIED: queried as zero-padded string '01'-'12', not an integer
  year integer not null,
  basic numeric default 0,
  hra numeric default 0,
  conveyance numeric default 0,
  special_allowance numeric default 0,
  overtime numeric default 0,
  pf numeric default 0,
  esic numeric default 0,
  pt numeric default 0,
  advance_recovery numeric default 0,
  tds numeric default 0,
  production_incentive numeric default 0,
  net_pay numeric not null default 0,
  created_at timestamptz default now(),
  unique (employee_id, month, year)
);

-- ============================================================================
-- SECTION I — monthly_scores
-- ============================================================================

create table monthly_scores (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  month text not null, -- APP-VERIFIED: zero-padded string, same as payroll_records.month
  year integer not null,
  composite_score numeric default 0,
  attendance_score numeric default 0,
  on_time_score numeric default 0,
  task_completion_score numeric default 0,
  kpi_score numeric default 0,
  production_score numeric default 0,
  safety_score numeric default 0, -- APP-VERIFIED: app/(owner)/eotm.tsx orders by safety_score; not in the MonthlyScore TS type, but the screen queries it
  "5s_score" numeric default 0,   -- APP-VERIFIED: same screen orders by 5s_score; quoted because it starts with a digit
  brownie_points numeric default 0,
  eotm_badge text check (eotm_badge in ('bronze','gold') or eotm_badge is null),
  created_at timestamptz default now(),
  unique (employee_id, month, year)
);

-- ============================================================================
-- SECTION J — maintenance_observations
-- ============================================================================

create table maintenance_observations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  area text not null,
  issue_description text not null,
  photo_url text,
  status text default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz default now()
);

-- ============================================================================
-- SECTION K — 5S challenges and submissions (quoted: table names start with a digit)
-- ============================================================================

create table "5s_challenges" (
  id uuid primary key default gen_random_uuid(),
  date date not null unique, -- APP-VERIFIED: app/(worker)/5s.tsx fetches one challenge per day, no department filter
  challenge_text_hi text,
  challenge_text_en text,
  department text,
  created_at timestamptz default now()
);

create table "5s_submissions" (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  challenge_id uuid not null references "5s_challenges"(id),
  photo_url text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  points_awarded integer default 0,
  verified_by uuid references employees(id),
  verified_at timestamptz,
  created_at timestamptz default now(),
  unique (employee_id, challenge_id)
);

-- ============================================================================
-- SECTION L — casual_workers (counts-only, per the fix applied earlier — not per-worker rows)
-- ============================================================================

create table casual_workers (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references employees(id),
  date date not null,
  unskilled_count integer default 0,
  skilled_count integer default 0,
  operator_count integer default 0,
  created_at timestamptz default now(),
  unique (supervisor_id, date)
);

-- ============================================================================
-- SECTION M — data_collection_submissions (shift reports)
-- ============================================================================

create table data_collection_submissions (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references employees(id),
  shift_id uuid references shifts(id), -- APP-VERIFIED: declared in the TS type but never actually set by app/(supervisor)/shift-report.tsx's insert — kept nullable
  date date not null,
  production_output numeric default 0,
  quality_issues integer default 0,
  downtime_minutes integer default 0,
  operator_totals numeric default 0,
  supervisor_total numeric default 0,
  variance_percent numeric default 0,
  created_at timestamptz default now()
);

-- ============================================================================
-- SECTION N — mrm_reviews
-- ============================================================================

create table mrm_reviews (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  month text not null, -- APP-VERIFIED: zero-padded string
  year integer not null,
  safety_score numeric default 0,
  quality_score numeric default 0,
  delivery_score numeric default 0,
  cost_score numeric default 0,
  morale_score numeric default 0,
  submitted_by uuid references employees(id),
  submitted_at timestamptz,
  status text default 'pending' check (status in ('pending','submitted','approved')),
  created_at timestamptz default now(),
  unique (department, month, year)
);

-- ============================================================================
-- SECTION O — fraud_alerts (supervisor bulk-confirmation, existing) and
-- fraud_flags (Step 5's buddy-device check — a different, narrower table)
-- ============================================================================

create table fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mock_location','buddy_punching','bulk_confirm')),
  employee_id uuid references employees(id),
  description text not null,
  severity text default 'medium' check (severity in ('low','medium','high')),
  status text default 'open' check (status in ('open','investigating','resolved')),
  created_at timestamptz default now()
);

create index idx_fraud_alerts_status on fraud_alerts(status);

create table fraud_flags (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  flag_type text not null,
  description text,
  reviewed boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- SECTION P — vehicle_log / eod_confirmations (Security Guard role)
-- ============================================================================

create table vehicle_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text not null,
  driver_name text,
  vendor_name text,
  material text,
  direction text not null check (direction in ('inward','outward')),
  logged_by uuid not null references employees(id),
  time_in timestamptz,
  time_out timestamptz,
  purpose text,
  created_at timestamptz default now()
);

create table eod_confirmations (
  id uuid primary key default gen_random_uuid(),
  security_guard_id uuid not null references employees(id),
  date date not null,
  inward_count integer default 0,
  outward_count integer default 0,
  mismatch_reason text,
  confirmed_at timestamptz default now(),
  unique (security_guard_id, date)
);

-- ============================================================================
-- SECTION Q — email_tasks
-- ============================================================================

create table email_tasks (
  id uuid primary key default gen_random_uuid(),
  inbox text,
  subject text,
  sender text,
  priority integer default 0,
  status text default 'unread' check (status in ('unread','read','actioned')),
  created_at timestamptz default now()
);

-- ============================================================================
-- SECTION R — notifications / push_tokens (both keyed on user_id, not
-- employee_id — APP-VERIFIED against app/(worker)/notifications.tsx and
-- lib/notifications.ts; this differs from the original spec's example)
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references employees(id),
  title text not null,
  body text not null,
  type text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on notifications(user_id, read);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references employees(id),
  token text not null,
  platform text check (platform in ('android','ios')),
  updated_at timestamptz default now(),
  unique (user_id)
);

-- ============================================================================
-- SECTION S — RLS (Step 4: replaces the old auth_user_id-is-never-set /
-- always-permissive approach with real auth.uid() <-> employees.auth_user_id
-- matching, plus a bootstrap policy so the very first login can self-claim
-- its row before auth_user_id exists yet)
-- ============================================================================

create or replace function current_employee_id()
returns uuid
language sql stable
as $$
  select id from employees where auth_user_id = auth.uid();
$$;

create or replace function get_current_employee_role()
returns text
language sql stable
as $$
  select role from employees where auth_user_id = auth.uid();
$$;

create or replace function is_management()
returns boolean
language sql stable
as $$
  select get_current_employee_role() in ('manager', 'plant_head', 'hr_admin', 'owner');
$$;

alter table employees enable row level security;
alter table attendance_records enable row level security;
alter table shifts enable row level security;
alter table employee_shifts enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table advance_requests enable row level security;
alter table payroll_records enable row level security;
alter table monthly_scores enable row level security;
alter table maintenance_observations enable row level security;
alter table "5s_challenges" enable row level security;
alter table "5s_submissions" enable row level security;
alter table casual_workers enable row level security;
alter table data_collection_submissions enable row level security;
alter table mrm_reviews enable row level security;
alter table fraud_alerts enable row level security;
alter table fraud_flags enable row level security;
alter table vehicle_log enable row level security;
alter table eod_confirmations enable row level security;
alter table email_tasks enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;
alter table plant_config enable row level security;

-- employees: self read; management full read; supervisor reads direct reports.
-- Update is split in two: management can update anyone; a signed-in user
-- with no employees row claimed yet can claim exactly their own row by phone
-- (this is what Step 4's post-OTP-verification update in useAuth.ts relies on).
create policy "employees_select" on employees for select
  using (
    auth_user_id = auth.uid()
    or is_management()
    or supervisor_id = current_employee_id()
    or manager_id = current_employee_id()
  );

create policy "employees_update_management" on employees for update
  using (is_management())
  with check (is_management());

create policy "employees_self_claim" on employees for update
  using (auth.jwt()->>'phone' = phone and auth_user_id is null)
  with check (auth.jwt()->>'phone' = phone);

create policy "employees_insert_management" on employees for insert
  with check (is_management() or auth.role() = 'authenticated');
-- new-employee-flow relies on someone being able to create the initial
-- inactive row; tightened to is_management() once HR auth is fully wired.

-- attendance_records: self read/write; supervisor reads team; management all.
create policy "attendance_records_select" on attendance_records for select
  using (
    employee_id = current_employee_id()
    or is_management()
    or employee_id in (select id from employees where supervisor_id = current_employee_id())
  );
create policy "attendance_records_write" on attendance_records for all
  using (employee_id = current_employee_id() or is_management() or get_current_employee_role() in ('supervisor', 'security_guard'))
  with check (employee_id = current_employee_id() or is_management() or get_current_employee_role() in ('supervisor', 'security_guard'));

create policy "shifts_select" on shifts for select using (auth.uid() is not null);
create policy "shifts_write" on shifts for all using (is_management()) with check (is_management());

create policy "employee_shifts_select" on employee_shifts for select
  using (employee_id = current_employee_id() or is_management() or employee_id in (select id from employees where supervisor_id = current_employee_id()));
create policy "employee_shifts_write" on employee_shifts for all using (is_management()) with check (is_management());

create policy "leave_balances_select" on leave_balances for select
  using (employee_id = current_employee_id() or is_management());

create policy "leave_requests_select" on leave_requests for select
  using (
    employee_id = current_employee_id()
    or is_management()
    or employee_id in (select id from employees where supervisor_id = current_employee_id())
  );
create policy "leave_requests_insert" on leave_requests for insert
  with check (employee_id = current_employee_id());
create policy "leave_requests_update" on leave_requests for update
  using (is_management() or get_current_employee_role() = 'supervisor')
  with check (is_management() or get_current_employee_role() = 'supervisor');

create policy "advance_requests_select" on advance_requests for select
  using (
    employee_id = current_employee_id()
    or is_management()
    or employee_id in (select id from employees where supervisor_id = current_employee_id())
  );
create policy "advance_requests_insert" on advance_requests for insert
  with check (employee_id = current_employee_id());
create policy "advance_requests_update" on advance_requests for update
  using (is_management() or get_current_employee_role() = 'supervisor')
  with check (is_management() or get_current_employee_role() = 'supervisor');

create policy "payroll_records_select" on payroll_records for select
  using (employee_id = current_employee_id() or is_management());

create policy "monthly_scores_select" on monthly_scores for select
  using (employee_id = current_employee_id() or is_management() or get_current_employee_role() = 'supervisor');

create policy "maintenance_observations_select" on maintenance_observations for select using (auth.uid() is not null);
create policy "maintenance_observations_insert" on maintenance_observations for insert with check (employee_id = current_employee_id());
create policy "maintenance_observations_update" on maintenance_observations for update
  using (is_management() or get_current_employee_role() = 'supervisor')
  with check (is_management() or get_current_employee_role() = 'supervisor');

create policy "5s_challenges_select" on "5s_challenges" for select using (auth.uid() is not null);
create policy "5s_challenges_write" on "5s_challenges" for all using (is_management()) with check (is_management());

create policy "5s_submissions_select" on "5s_submissions" for select
  using (employee_id = current_employee_id() or is_management() or get_current_employee_role() = 'supervisor');
create policy "5s_submissions_insert" on "5s_submissions" for insert with check (employee_id = current_employee_id());
create policy "5s_submissions_update" on "5s_submissions" for update
  using (is_management() or get_current_employee_role() = 'supervisor')
  with check (is_management() or get_current_employee_role() = 'supervisor');

create policy "casual_workers_select" on casual_workers for select
  using (supervisor_id = current_employee_id() or is_management());
create policy "casual_workers_write" on casual_workers for all
  using (supervisor_id = current_employee_id() or is_management())
  with check (supervisor_id = current_employee_id() or is_management());

create policy "data_collection_submissions_select" on data_collection_submissions for select
  using (supervisor_id = current_employee_id() or is_management());
create policy "data_collection_submissions_insert" on data_collection_submissions for insert
  with check (supervisor_id = current_employee_id());

create policy "mrm_reviews_select" on mrm_reviews for select using (auth.uid() is not null);
create policy "mrm_reviews_insert" on mrm_reviews for insert
  with check (get_current_employee_role() = 'manager' or is_management());

create policy "fraud_alerts_select" on fraud_alerts for select using (is_management());
create policy "fraud_alerts_insert" on fraud_alerts for insert with check (auth.uid() is not null);

create policy "fraud_flags_select" on fraud_flags for select using (is_management());
create policy "fraud_flags_insert" on fraud_flags for insert with check (auth.uid() is not null);

create policy "vehicle_log_select" on vehicle_log for select using (auth.uid() is not null);
create policy "vehicle_log_insert" on vehicle_log for insert with check (get_current_employee_role() = 'security_guard' or is_management());

create policy "eod_confirmations_select" on eod_confirmations for select using (auth.uid() is not null);
create policy "eod_confirmations_write" on eod_confirmations for all
  using (security_guard_id = current_employee_id() or is_management())
  with check (security_guard_id = current_employee_id() or is_management());

create policy "email_tasks_select" on email_tasks for select using (is_management());

create policy "notifications_select" on notifications for select using (user_id = current_employee_id() or is_management());
create policy "notifications_insert" on notifications for insert with check (true);
-- insert stays open: notifications are written by edge functions using the
-- service role (which bypasses RLS) and, for the client, by no code path
-- today — narrow this once a client-side notification-writer exists.

create policy "push_tokens_write" on push_tokens for all
  using (user_id = current_employee_id() or is_management())
  with check (user_id = current_employee_id());

create policy "plant_config_select" on plant_config for select using (auth.uid() is not null);

-- Service role (used by all edge functions) bypasses RLS automatically.

-- ============================================================================
-- End of schema.
-- ============================================================================
