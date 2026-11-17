-- PATCH_138: schema half of two fixes found during an investigation of the already-
-- finalized October 2026 payroll run (money already paid):
--
-- 1. supabase/functions/payroll-run/index.ts's loadFeeds() fetched attendance_records
--    (and leave_requests) with a single, unpaginated .select() — PostgREST silently
--    caps an unbounded select at its configured max-rows (observed ~1000 rows here).
--    October 2026 has 2,731 attendance_records rows (4,299 live in the table overall),
--    so the October run's feed read was silently truncated with NO error, and most
--    staff+worker employees' "worked days" were computed off an incomplete attendance
--    set. Fixed in code (lib/payroll/pagedFetch.ts + the vendored copy + index.ts's
--    new fetchAllRows() wrapper) — this is a pure read-path fix, no schema change.
--
-- 2. To correct the already-finalized October run WITHOUT double-paying anyone, the
--    existing top-up mechanism (create_topup / adjustment_of) needs a second mode: pay
--    only the SHORTFALL for someone who already has an item (not just pay someone who
--    was entirely missed, which is what create_topup already does). This column is that
--    second mode's flag.
--
-- Column only. Does NOT touch any existing pay_runs row (default false = every run
-- ever created keeps today's exact behaviour). Does NOT apply any correction itself —
-- that happens later via a 'calculate' call on a run created with
-- { action: 'create_topup', parentRunId, paysDeltaOnly: true }, reviewed and triggered
-- by a human (owner/hr_admin), never automatically.
--
-- Chosen mechanism: reuse the existing `adjustment_of` column (already identifies "this
-- is a top-up/adjustment run of that parent") and add one boolean flag distinguishing
-- WHICH kind of top-up it is, rather than a new `correction_mode` text column or a
-- separate run type. Smaller migration (one boolean, one default, no CHECK/enum to
-- maintain), and every existing run (`adjustment_of` null OR `pays_delta_only` false)
-- is byte-for-byte unaffected — buildRunInputs()/calculate only branch on this flag
-- when it is explicitly true AND adjustment_of is set.
--
-- DO NOT APPLY to the live database without independent review — this changes how a
-- payroll run can now compute net_pay. Written by a Sonnet build agent on the
-- orchestrating Claude session's instruction; review before running.

alter table public.pay_runs
  add column if not exists pays_delta_only boolean not null default false;

comment on column public.pay_runs.pays_delta_only is
  'PATCH_138, 17 Nov 2026. Only meaningful when adjustment_of is set (a top-up/'
  'adjustment run). false (default): plain top-up — an employee who already has a '
  'pay_run_item in any non-cancelled run of the same pay period is skipped entirely '
  '(unchanged behaviour since PATCH_89). true: delta-only CORRECTION run — nobody is '
  'skipped; calculate() sums each employee''s existing net_pay across every prior '
  'non-cancelled run of the period, recomputes their correct total from the (now '
  'pagination-fixed) feeds, and writes a pay_run_item for only the POSITIVE '
  'difference (correctTotal - alreadyPaid). An employee with no prior item is paid '
  'in full, exactly like a plain top-up. An employee whose delta is <= 0 (already '
  'correctly paid, or overpaid) gets no item at all. Every such item''s snapshot '
  'carries correctionOf = { parentRunId, alreadyPaid, correctTotal, delta } so the '
  'math is auditable from the row alone.';
