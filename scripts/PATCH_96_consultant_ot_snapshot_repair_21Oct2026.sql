-- PATCH_96 — consultant pay_run_items OT snapshot repair (21 Oct 2026)
-- Applied 2026-10-21 by owner (directly in SQL Editor). Recorded here afterwards
-- so the repo matches the DB. Do NOT re-run.
--
-- Purpose: one-time data repair. The archived Apr-Sep 2026 consultant
-- pay_run_items snapshots had lost their overtime lines. The owner restored the
-- OT keys in each affected snapshot (otPay, otHours, earnings.OT, totalEarnings);
-- net_pay was left unchanged (it already included the OT amount).
--
-- Why the trigger dance: pay_run_items carries trg_lock_items_upd
-- (BEFORE DELETE OR UPDATE ... lock_finalized_pay_run_items()), which raises
-- 'Pay run is finalized — items are immutable' for runs in finalized /
-- payment_file_generated / paid / archived. These runs are archived, so the
-- trigger had to be disabled for the update and re-enabled straight after.
--
-- Live state checked read-only 21 Oct 2026 (after the repair):
--   * trg_lock_items_upd: tgenabled = 'O' (enabled), on public.pay_run_items.
--   * Consultant items with OT restored (snapshot.otPay > 0 AND earnings ? 'OT'),
--     all runs archived, otPay / otHours / earnings.OT / totalEarnings consistent:
--       2026-04: 4   (CON01, CON16, CON18, CON21)
--       2026-05: 5   (CON01, CON16, CON18, CON20, CON21)
--       2026-06: 6   (CON01, CON16, CON18, CON20, CON21, CON22)
--       2026-07: 1   (CON01)
--       2026-08: 4   (CON01, CON16, CON18, CON20)
--       2026-09: 3   (CON01, CON20, CON24)
--     = 23 rows live (owner's note said 24 — see NOTE below).
--   * Every consultant snapshot (all 52) has the otPay / otHours keys.
--
-- The exact per-row values are NOT reproduced here (they cannot be reconstructed
-- from anything but the original source sheet figures); the per-row result is
-- visible in the verification query at the bottom. The repaired shape of each
-- snapshot is:
--     snapshot.otHours             = OT hours for the month
--     snapshot.otPay               = OT amount
--     snapshot.earnings.OT         = same amount as otPay
--     snapshot.totalEarnings       = total including OT (equals net_pay for
--                                    consultants, who have no deductions)
--
-- NOTE: the owner described 24 rows; the live DB shows 23 consultant items with
-- OT > 0. If a 24th was touched, it carries no OT value now.

-- 1. Unlock (the repair step, kept for the record — do not run again):
-- alter table public.pay_run_items disable trigger trg_lock_items_upd;

-- 2. The repair itself (24 consultant items; descriptive only, no values invented):
-- update public.pay_run_items i
--    set snapshot = jsonb_set(
--                     jsonb_set(
--                       jsonb_set(
--                         jsonb_set(i.snapshot, '{otHours}',        to_jsonb(<ot_hours>)),
--                                              '{otPay}',          to_jsonb(<ot_pay>)),
--                                              '{earnings,OT}',    to_jsonb(<ot_pay>)),
--                                              '{totalEarnings}',  to_jsonb(<total_earnings>))
--  where i.id = <pay_run_item_id>;          -- one statement per affected item
-- -- net_pay deliberately NOT updated.

-- 3. Re-lock:
-- alter table public.pay_run_items enable trigger trg_lock_items_upd;

-- Safe, idempotent assertion that the trigger is back on (harmless if re-run):
alter table public.pay_run_items enable trigger trg_lock_items_upd;

-- 4. Verification (read-only) — trigger state, then OT items by month:
select tgname, tgenabled from pg_trigger where tgname = 'trg_lock_items_upd';   -- expect 'O'

select pp.year, pp.month, count(*) as ot_items
  from public.pay_run_items i
  join public.employees e  on e.id  = i.employee_id
  join public.pay_runs pr  on pr.id = i.pay_run_id
  join public.pay_periods pp on pp.id = pr.pay_period_id
 where e.category = 'consultant'
   and coalesce((i.snapshot->>'otPay')::numeric, 0) > 0
   and i.snapshot->'earnings' ? 'OT'
 group by pp.year, pp.month
 order by pp.year, pp.month;
