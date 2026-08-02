-- ============================================================================
-- FORGE OS — frontend-aligned schema patch
--
-- Context: scripts/schema.sql was written before the actual React Native
-- (Expo) codebase existed, from the Master System Definition doc alone. Now
-- that the real frontend (forgeoscomplete.zip) is in this repo, several of
-- its Supabase queries use different table/column names than schema.sql
-- guessed (e.g. `attendance_records` not `attendance`, `employees.emp_code`
-- not `employee_code`, `department` as a plain string, etc). Reconciling
-- every table is a larger follow-up; this file defines ONLY the tables
-- needed to ship the 5 fixes requested for the frontend:
--
--   1. Role-based routing            — no schema change
--   2. Security Guard role           — vehicle_log, eod_confirmations,
--                                       attendance_records.checkpoint2_*
--   3. Casual worker counts screen   — casual_workers (redefined)
--   4. Fraud detection in team.tsx   — fraud_alerts
--   5. plant_config key-value fix    — plant_config (key-value, seeded)
--
-- Run this after scripts/schema.sql (or standalone against a fresh project
-- if you're only running the frontend for now — every statement here is
-- self-contained and only depends on `employees` from schema.sql).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- plant_config — key-value (fix #5). The frontend was querying this as a
-- single flat row (`select("*").single()`); the real design is key-value so
-- new config can be added without a migration. Seeded with everything
-- app/qr/index.tsx and lib/location.ts need.
-- ----------------------------------------------------------------------------

create table if not exists plant_config (
  config_key text primary key,
  config_value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into plant_config (config_key, config_value, description) values
  ('plant_code', '"VFL-AKT"', 'Plant identifier embedded in the daily gate QR hash'),
  ('gps_lat', '19.8383935925407', 'Plant latitude'),
  ('gps_lng', '75.23638998304483', 'Plant longitude'),
  ('geofence_radius_meters', '100', 'Check-in GPS geofence radius in metres'),
  ('plant_name', '"Varsha Forgings Pvt Ltd"', 'Display name for the plant'),
  ('qr_secret_salt', '"CHANGE_ME_ROTATE_IN_PRODUCTION"', 'Secret mixed into the daily gate QR hash (plant_code + date + salt). Rotate via the Supabase dashboard before go-live.')
on conflict (config_key) do nothing;

alter table plant_config enable row level security;
drop policy if exists "plant_config read all" on plant_config;
create policy "plant_config read all" on plant_config for select using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- attendance_records — the table the real frontend actually reads/writes
-- (app/qr, app/(worker)/attendance.tsx, app/(supervisor)/team.tsx, etc.).
-- Columns mirror types/index.ts AttendanceRecord, plus the two checkpoint-2
-- columns needed for the new Security Guard confirmation screen (fix #2).
-- ----------------------------------------------------------------------------

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  date date not null,
  status text not null default 'A', -- P / A / L / H / W / HD
  check_in_time timestamptz,
  check_out_time timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  is_late boolean not null default false,
  late_reason text,
  checkpoint2_confirmed_by uuid references employees(id), -- Security Guard "Seen" confirmation
  checkpoint2_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, date)
);

alter table attendance_records add column if not exists checkpoint2_confirmed_by uuid references employees(id);
alter table attendance_records add column if not exists checkpoint2_at timestamptz;

create index if not exists idx_attendance_records_date on attendance_records(date);
create index if not exists idx_attendance_records_employee on attendance_records(employee_id, date);

alter table attendance_records enable row level security;
drop policy if exists "attendance_records access" on attendance_records;
create policy "attendance_records access" on attendance_records for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
-- NOTE: intentionally permissive (matches the rest of this app's client-only,
-- no-edge-function architecture — every screen reads/writes tables directly
-- with the anon key). Tighten to role/ownership-scoped policies before
-- production; out of scope for today's 5 fixes.

-- ----------------------------------------------------------------------------
-- casual_workers — replaces the old name/temp-ID free-text shape with 3
-- daily counts per supervisor, no names or IDs (fix #3).
-- ----------------------------------------------------------------------------

drop table if exists casual_workers;

create table casual_workers (
  id uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references employees(id),
  date date not null,
  unskilled_count int not null default 0,
  skilled_count int not null default 0,
  operator_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supervisor_id, date)
);

alter table casual_workers enable row level security;
drop policy if exists "casual_workers access" on casual_workers;
create policy "casual_workers access" on casual_workers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- fraud_alerts — matches types/index.ts FraudAlert exactly (already queried
-- by app/(owner)/alerts.tsx and app/(owner)/index.tsx). Written to by the
-- new bulk-confirmation check in app/(supervisor)/team.tsx (fix #4).
-- ----------------------------------------------------------------------------

create table if not exists fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mock_location', 'buddy_punching', 'bulk_confirm')),
  employee_id uuid references employees(id),
  description text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_fraud_alerts_status on fraud_alerts(status);

alter table fraud_alerts enable row level security;
drop policy if exists "fraud_alerts insert" on fraud_alerts;
create policy "fraud_alerts insert" on fraud_alerts for insert with check (auth.role() = 'authenticated');
drop policy if exists "fraud_alerts select" on fraud_alerts;
create policy "fraud_alerts select" on fraud_alerts for select using (auth.role() = 'authenticated');
-- Read access is intentionally broad for the same reason as attendance_records
-- above; tighten to management-only once real auth roles are enforced.

-- ----------------------------------------------------------------------------
-- vehicle_log / eod_confirmations — Security Guard screens (fix #2). Net new;
-- nothing in the frontend referenced these yet before today.
-- ----------------------------------------------------------------------------

create table if not exists vehicle_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text not null,
  driver_name text,
  vendor_name text,
  material text,
  direction text not null check (direction in ('inward', 'outward')),
  logged_by uuid not null references employees(id),
  time_in timestamptz,
  time_out timestamptz,
  purpose text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_log_created on vehicle_log(created_at);

alter table vehicle_log enable row level security;
drop policy if exists "vehicle_log access" on vehicle_log;
create policy "vehicle_log access" on vehicle_log for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- No goods_receipt_notes / purchase_order tables exist anywhere in this
-- frontend yet (no procurement screens have been built), so EOD lock can't
-- do the doc's literal "vehicle count vs GRN count" match. Until a GRN
-- module exists, EOD lock instead checks inward vs outward count
-- self-consistency for the day and requires a reason on mismatch —
-- see app/(security)/eod-lock.tsx.
create table if not exists eod_confirmations (
  id uuid primary key default gen_random_uuid(),
  security_guard_id uuid not null references employees(id),
  date date not null,
  inward_count int not null default 0,
  outward_count int not null default 0,
  mismatch_reason text,
  confirmed_at timestamptz not null default now(),
  unique (security_guard_id, date)
);

alter table eod_confirmations enable row level security;
drop policy if exists "eod_confirmations access" on eod_confirmations;
create policy "eod_confirmations access" on eod_confirmations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================================
-- End of patch.
-- ============================================================================
