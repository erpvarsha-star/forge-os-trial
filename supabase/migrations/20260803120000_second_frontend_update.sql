-- ============================================================================
-- FORGE OS — second frontend update patch
--
-- Context: this repo's frontend was replaced by a newer, independent
-- generation (forgeos.zip, 2026-08-03) with a different route/screen
-- structure. Re-applies the same 5 fixes from the previous round against
-- this new codebase's actual table usage:
--
--   1. Role-based routing            — no schema change (already correct
--                                       via constants/ROLE_ROUTES + app/index.tsx)
--   2. Security Guard role           — vehicle_log, eod_confirmations,
--                                       attendance_records.checkpoint2_*
--                                       (already added in the previous
--                                       migration — unchanged here)
--   3. Casual worker counts screen   — casual_workers (already counts-based
--                                       from the previous migration — unchanged)
--   4. Fraud detection in team.tsx   — fraud_alerts (already added — unchanged);
--                                       "notify plant head" needs push_tokens
--                                       in the shape this codebase actually
--                                       writes (user_id/token/platform, not
--                                       employee_id/expo_push_token/device_type
--                                       from the original schema.sql)
--   5. plant_config key-value fix    — plant_config (already key-value —
--                                       unchanged)
--
-- Also adds attendance_records.qr_verified, which this codebase's
-- useAttendance.checkIn() writes on every check-in but no prior migration
-- defined.
-- ============================================================================

alter table attendance_records add column if not exists qr_verified boolean not null default false;

drop table if exists push_tokens;

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references employees(id),
  token text not null unique,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on push_tokens(user_id);

alter table push_tokens enable row level security;
drop policy if exists "push_tokens access" on push_tokens;
create policy "push_tokens access" on push_tokens for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
-- Same intentionally-broad policy rationale as attendance_records/fraud_alerts
-- in the previous migration: this codebase's screens query tables directly
-- with the anon key, with no server-side layer. Tighten before production.
