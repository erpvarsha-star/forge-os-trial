-- PATCH_127: advance_requests.first_recovery_month — defer recovery start month
-- Applied LIVE 4 Nov 2026 via the Supabase MCP tool (execute_sql; ALTER/UPDATE
-- only, no DROP/DELETE).
--
-- BUG (already root-caused before this patch): advance_requests has no concept
-- of "which month recovery starts". lib/payroll/feedSync.ts deducts
-- min(monthly_deduction, outstanding_balance) for every approved advance in
-- EVERY pay period processed for that employee, unconditionally, as long as
-- outstanding_balance > 0. There is no column to say "don't start deducting
-- until month X".
--
-- LIVE DATA PROBLEM this patch fixes: on 2 Nov 2026 the owner approved 21
-- "Diwali advance" rows (Rs 15,000 each, monthly_deduction=1500,
-- outstanding_balance=15000, reason text containing
-- "Diwali advance, owner-approved 2 Nov 2026"). Owner's explicit instruction
-- (CLAUDE.md, "Owner answers of 2 Nov 2026 (second afternoon batch)" item 3,
-- reaffirmed in the "third afternoon batch" item 3): the Rs 15,000 is paid OUT
-- to the employee IN the October salary (handled separately via
-- payroll_adjustments — untouched by this patch), but the Rs 1,500/month
-- RECOVERY instalment must not be deducted until the NOVEMBER pay run.
-- Without this fix, an October 2026 payroll-run calculate would incorrectly
-- deduct Rs 1,500 from all 21 people's October pay.
--
-- The VFL4063 advance_requests row referenced in the same owner message is
-- already status='rejected', amount=0 — explicitly left untouched by this
-- patch (it contributes 0 to feedSync's advance sum regardless, since the
-- filter is status === 'approved').
--
-- Scope: exactly the 21 approved rows whose reason contains the literal
-- string "Diwali advance, owner-approved 2 Nov 2026". Verified count before
-- applying: 21. Does NOT touch VFL1556 / VFL5324 (unrelated pending
-- advances), the rejected VFL4063 row, or any other advance_requests row.

-- STEP 1: add the column. NULL means "recovery starts immediately" —
-- i.e. existing behavior is unchanged for every advance that doesn't set it.
alter table public.advance_requests
  add column if not exists first_recovery_month text;

comment on column public.advance_requests.first_recovery_month is
  'YYYY-MM. Recovery (monthly_deduction) is skipped by payroll feedSync for any pay period before this month. NULL = recovery starts immediately (pre-existing behavior).';

-- STEP 2: backfill exactly the 21 Diwali-advance rows to start recovery in
-- November 2026 (the October disbursement is paid via payroll_adjustments,
-- separately, and is NOT affected by this column).
update public.advance_requests
set first_recovery_month = '2026-11'
where status = 'approved'
  and reason ilike '%Diwali advance, owner-approved 2 Nov 2026%';

-- Verification queries (run after applying, not part of the migration):
--   select count(*) from advance_requests where first_recovery_month = '2026-11';  -- expect 21
--   select count(*) from advance_requests where first_recovery_month is not null and
--     reason not ilike '%Diwali advance, owner-approved 2 Nov 2026%';               -- expect 0
