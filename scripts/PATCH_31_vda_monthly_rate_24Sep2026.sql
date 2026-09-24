-- PATCH_31: Salary consolidation — real VDA formula, found by backtesting
-- every monthly tab of both calc sheets back to Apr 2022 (24 Sep 2026).
-- Plan: /root/.claude/plans/zazzy-sauteeing-crystal.md (session 24 Sep 2026).
--
-- The blueprint's original assumption (VDA pro-rates like Basic: fixed rate
-- x Days Payable / Working Days) was WRONG — backtested at 25-55% match
-- across 1,718 real employee-months, never close to a usable formula.
--
-- The real formula, confirmed EXACT for all 172 employee-months checked
-- across the 7 most recent tabs (Feb 2026 - Aug 2026, 100% match, 0
-- exceptions):
--
--     VDA = round(per-day VDA rate x Present Days)
--
-- Two things distinguish this from every other component:
--   1. It excludes EL/CL/SL/PH entirely — Present Days ONLY, unlike Basic/
--      HRA/etc which pro-rate off Days Payable (Present + paid leave).
--   2. The per-day rate is a company-wide value that changes periodically
--      (found live in each monthly tab, 2 rows above the "V.D.A." header:
--      e.g. ₹103/day Aug 2026, ₹93/day Jul 2026, ₹83.48/day the Aug 2025-
--      Jan 2026 block) — NOT derivable from `employee_salary_structure`,
--      which only has each employee's stale one-time "VDA (F)" figure.
--      Every worker checked in a given month shared the identical rate, so
--      this is modelled as one value per month, not per employee/grade —
--      revisit if Yash confirms it actually varies by grade/department.
--
-- This table is entered ONCE per month (HR/Accounts, from whatever
-- notification sets the rate) and read by every worker's calculation that
-- month — same "entered once, applied to everyone" shape PATCH_30's
-- department_efficiency_actuals already established.
--
-- Also explains a real OT mismatch: Aug 2026's OT amounts in the live sheet
-- used JULY's VDA rate (₹93) instead of August's revised rate (₹103) —
-- back-solved from the actual OT figures, exact to 4 decimal places. This
-- confirms the OT formula itself was already correct
-- (`(Basic_F + VDA_F)/Working_Days/8 x 2 x OT_Hours`) — the sheet's VDA
-- input was just stale that month. `run-payroll` avoids repeating that by
-- always reading the current month's confirmed rate from this table.

BEGIN;

create table payroll_monthly_rates (
  id uuid primary key default gen_random_uuid(),
  month text not null, -- zero-padded '01'-'12', matches payroll_records.month
  year integer not null,
  vda_per_day_rate numeric not null,
  created_at timestamptz default now(),
  unique (month, year)
);

alter table payroll_monthly_rates enable row level security;

create policy "payroll_monthly_rates_select" on payroll_monthly_rates
  for select using (is_management());

-- No insert/update policy — same convention as the rest of this project's
-- reference/input tables: service-role (edge function or admin) only.

COMMIT;
