-- PATCH_125: Worker production-allowance slab table + per-month Days Payable.
-- Applied LIVE 4 Nov 2026 via the Supabase MCP tool (statement-by-statement,
-- same "drop the IF EXISTS guards, issue plain CREATE statements one at a
-- time" workaround this project has used before — apply_migration and any
-- DROP/guarded statement time out on this project's MCP connection waiting
-- on a confirmation that never reaches the session).
--
-- Source: owner-uploaded Salary_app_correction_points.xlsx, "Efficiency"
-- sheet, read directly with openpyxl (not transcribed secondhand):
--   Eff. Slabs                         0.81  0.82  0.83  0.84  0.85
--   Eff Amount 01/09/23 To 31/08/25    3000  3500  4000  4500  5000
--   Eff Amount 01/09/25 To 31/08/26    1500  1500  2500  3000  3500
--   Amount to be given After 31 Aug 2025  4500  5000  6500  7500  8500   <- LIVE/applicable column
--   October 2026: Efficiency Achieved 81% -> flat amount 4500; Days Payable = 25 (HR-entered, NOT a fixed 26).
--   Worked example (VFL4008): 21 physical present days -> 4500 x 21/25 = 3780. Matches the sheet exactly.
--
-- Replaces the engine's previous behaviour of always dividing the slab
-- amount by the general working-days count (`wd`) — correct for Sept 2026
-- (where Days Payable happened to equal wd=26) but wrong for Oct 2026
-- (Days Payable=25 while wd=26). See lib/payroll/engine.ts / feedSync.ts for
-- the wiring (new `efficiencyAmountOverride` / `daysPayableOverride` input
-- fields; the engine's own PROD_SLAB/wd combination remains ONLY as the
-- fallback used when no month entry exists, for backward/historical
-- compatibility — never hardcode a specific month's numbers into the engine).

create table if not exists public.payroll_efficiency_slabs (
  slab_pct integer primary key check (slab_pct between 0 and 100),
  amount_pre_aug2025 numeric not null,       -- "Eff Amount 01/09/23 To 31/08/25"
  amount_sep2025_aug2026 numeric not null,   -- "Eff Amount 01/09/25 To 31/08/26"
  amount_post_aug2025 numeric not null,      -- "Amount to be given After 31 Aug 2025" (LIVE/applicable column)
  agreement_note text default 'Efficiency slabs as per Agreement 01/09/23 to 31/03/2028 (Salary_app_correction_points.xlsx, Efficiency sheet, uploaded by owner 4 Nov 2026)'
);

alter table public.payroll_efficiency_slabs enable row level security;

create policy efficiency_slabs_mgmt on public.payroll_efficiency_slabs
  for all
  using (coalesce(get_current_employee_role() in ('owner','hr_admin','plant_head'), false))
  with check (coalesce(get_current_employee_role() in ('owner','hr_admin','plant_head'), false));
-- Same role set as the existing `efficiency_mgmt` policy on payroll_efficiency_entries
-- (plant_head included because he is the one who enters the monthly efficiency %).

insert into public.payroll_efficiency_slabs (slab_pct, amount_pre_aug2025, amount_sep2025_aug2026, amount_post_aug2025)
values
  (81, 3000, 1500, 4500),
  (82, 3500, 1500, 5000),
  (83, 4000, 2500, 6500),
  (84, 4500, 3000, 7500),
  (85, 5000, 3500, 8500)
on conflict (slab_pct) do update set
  amount_pre_aug2025 = excluded.amount_pre_aug2025,
  amount_sep2025_aug2026 = excluded.amount_sep2025_aug2026,
  amount_post_aug2025 = excluded.amount_post_aug2025;

-- Per-month HR input: payroll_efficiency_entries already holds
-- {payroll_month, employee_id (null=plant-wide), efficiency_pct}. Add the
-- missing "Days Payable" figure so one monthly entry carries both inputs
-- the slab lookup needs.
alter table public.payroll_efficiency_entries add column if not exists days_payable numeric;
comment on column public.payroll_efficiency_entries.days_payable is
  'HR-entered "Days Payable" denominator for that month''s worker production-allowance proration (Salary_app_correction_points.xlsx Efficiency sheet). NULL = engine falls back to the general working-days count (historical/legacy behaviour).';

-- Guard against an ambiguous duplicate plant-wide approved entry for the same
-- month (feedSync picks the first employee_id IS NULL approved row it finds).
create unique index payroll_efficiency_entries_plantwide_month_uniq
  on public.payroll_efficiency_entries (payroll_month)
  where employee_id is null and approval_status = 'approved';

-- October 2026 company-wide entry, exactly as given in the owner's own
-- uploaded sheet (plant-wide figures only — individual worker-level present-
-- day counts from that same sheet are HR's own data and are NOT entered here;
-- the app's live attendance already supplies each worker's present days).
insert into public.payroll_efficiency_entries (payroll_month, employee_id, efficiency_pct, days_payable, approval_status, source, note)
values ('2026-10', null, 81, 25, 'approved', 'owner_upload',
  'From Salary_app_correction_points.xlsx (Efficiency sheet), uploaded by owner 4 Nov 2026: company-wide Oct 2026 efficiency achieved (81%) and HR Days Payable (25).')
on conflict do nothing;
