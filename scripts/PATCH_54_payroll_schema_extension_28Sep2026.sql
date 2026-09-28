-- PATCH_54 + PATCH_55 combined: schema additions needed to store the real
-- HR salary sheets (Consultant/Worker/Staff, Apr-Aug 2026) exactly, per
-- Yash's decision (28 Sep 2026) to store every line item rather than fold
-- extras into generic columns. Additive only, all nullable, no existing
-- data touched or removed.

alter table payroll_records
  -- employer-side contributions + leave encashment (Worker/Staff sheets)
  add column if not exists employer_pf numeric,
  add column if not exists employer_esi numeric,
  add column if not exists bonus numeric,
  add column if not exists gratuity numeric,
  add column if not exists leave_encashment numeric,
  -- staff-specific allowances not covered by any existing generic column
  add column if not exists education numeric,
  add column if not exists medical numeric,
  add column if not exists professional_development numeric,
  add column if not exists communication numeric,
  add column if not exists uniform numeric,
  add column if not exists washing numeric,
  -- worker-specific allowances
  add column if not exists heat_allowance numeric,
  add column if not exists vda numeric,
  add column if not exists production_allowance numeric,
  -- attendance breakdown detail
  add column if not exists week_off numeric;
