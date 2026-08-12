-- ============================================================================
-- PATCH_15 — landing tables for the Operations Dashboard sync
-- 12 Aug 2026
--
-- Two things the app has been unable to show because the data lives only in a
-- Google Sheet:
--
--   1. Which shift forms have actually been submitted, so the Forms tab can
--      say "2 of 3 shifts in" instead of just listing links.
--   2. Department production — the Cutting / HT / Final RAW tabs hold real
--      rows since 1 April and the app shows none of it.
--
-- Both are filled by syncOpsDashboardToSupabase() in scripts/ALERT.gs, which
-- pushes with the service role key from Script Properties. Because the service
-- role bypasses RLS entirely, neither table needs an INSERT policy — and
-- deliberately does not have one, so nothing signed in from the APK can forge
-- a submission or a production number.
--
-- row_key exists so the push can upsert. PostgREST needs a real unique
-- constraint to merge duplicates, and the natural key spans nullable columns
-- (shift is null on rows where the sheet's shift column holds a person's name
-- rather than a shift), which a plain UNIQUE would not collapse. Apps Script
-- builds the key; Postgres enforces it.
--
-- ⚠ RUN IN THE SUPABASE SQL EDITOR. Safe to re-run.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. form_submissions — one row per (date, department, shift)
--
-- ⚠ GRANULARITY: this is per SHIFT, not per FORM, and that is a limit of the
-- source rather than a design choice. The RAW tabs record that a department
-- submitted data for a shift; they do not record which of that shop's 3-6
-- daily forms it came from. Per-form ticking needs each form's own response
-- sheet wired up — see PENDING.md. Until then the app can say a shift is
-- outstanding, not which specific form is missing.
-- ---------------------------------------------------------------------------
create table if not exists public.form_submissions (
  id              uuid primary key default gen_random_uuid(),
  row_key         text not null unique,
  date            date not null,
  department      text not null,
  shift           text,
  status          text not null check (status in ('ON TIME', 'LATE', 'MISSING')),
  delay_minutes   integer,
  entry_time      text,
  supervisor_name text,
  source          text not null default 'ops_dashboard',
  synced_at       timestamptz not null default now()
);

create index if not exists idx_form_submissions_lookup
  on public.form_submissions (department, date);

alter table public.form_submissions enable row level security;

drop policy if exists "form_submissions_select_all" on public.form_submissions;
create policy "form_submissions_select_all" on public.form_submissions for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 2. production_records — one row per (date, department, shift, unit, vf_no)
--
-- The three RAW tabs have three different shapes:
--   Cutting  Date | Machine | Shift | VF_No | Qty
--   HT       Date | Furnace | Shift | Qty
--   Final    Date | Process | Shift | VF_No | Qty
-- `unit` is whichever of machine / furnace / process that tab carries, so the
-- three collapse into one table without inventing a column per shop.
--
-- ⚠ This is production per machine per shift, NOT per employee. It belongs on
-- the department dashboards; it must not feed an individual's score. That
-- distinction is why removing production from nightly-scoring was correct even
-- though the data turned out to exist.
-- ---------------------------------------------------------------------------
create table if not exists public.production_records (
  id          uuid primary key default gen_random_uuid(),
  row_key     text not null unique,
  date        date not null,
  department  text not null,
  shift       text,
  unit        text,
  vf_no       text,
  qty         numeric,
  source      text not null default 'ops_dashboard',
  synced_at   timestamptz not null default now()
);

create index if not exists idx_production_records_dept_date
  on public.production_records (department, date);

alter table public.production_records enable row level security;

drop policy if exists "production_records_select_all" on public.production_records;
create policy "production_records_select_all" on public.production_records for select
  using (auth.role() = 'authenticated');

commit;

-- ============================================================================
-- Verify (after the first sync run from the Apps Script editor)
-- ============================================================================
-- select department, count(*), max(date) from production_records group by 1 order by 1;
-- select department, date, shift, status from form_submissions order by date desc limit 20;
