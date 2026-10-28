-- PATCH_112 — Per-category (population) pay runs.
-- Prepared 28 Oct 2026 by Kimi Code. Status: PREPARED, NOT APPLIED.
-- ADDITIVE ONLY: one new nullable column + one NOT VALID CHECK + one index. No DROP, no DELETE.
--
-- Why: e.g. PUNE_STAFF can finalize alone on 2 Nov while other categories wait for
-- feeds. The filter is applied by supabase/functions/payroll-run AFTER feed assembly
-- and BEFORE the engine loop; engine math is untouched.
--
-- population = NULL means a whole-population run (everyone). All 24 existing pay_runs
-- stay NULL and behave exactly as before.
-- ============================================================================

alter table public.pay_runs
  add column if not exists population text;

-- Allowed values: NULL (whole population) or one of the four PayCategory values.
-- Added NOT VALID (no table scan, no lock on existing rows) then validated separately;
-- pattern per PATCH_103 conventions for constraint work on live tables.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pay_runs_population_check') then
    alter table public.pay_runs
      add constraint pay_runs_population_check
      check (population is null or population in ('STAFF','PERMANENT_WORKER','CONSULTANT','PUNE_STAFF'))
      not valid;
  end if;
end $$;

alter table public.pay_runs validate constraint pay_runs_population_check;

create index if not exists pay_runs_period_population_idx
  on public.pay_runs (pay_period_id, population);

-- Preview: current runs keep population NULL (whole-population runs).
select id, name, status, population
from public.pay_runs
order by created_at desc
limit 50;

-- ============================================================================
-- ROLLBACK (manual, if ever needed):
--   drop index if exists public.pay_runs_period_population_idx;
--   alter table public.pay_runs drop constraint if exists pay_runs_population_check;
--   alter table public.pay_runs drop column if exists population;  -- only while all rows are NULL
-- ============================================================================
