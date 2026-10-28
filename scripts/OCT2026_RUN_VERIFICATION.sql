-- ============================================================================
-- OCT2026_RUN_VERIFICATION.sql — prepared verification suite for the October
-- 2026 pay run (Goal 1, condition 2: "October run fully in-app").
-- Run each section in Supabase SQL Editor at the moment named in its header.
-- Read-only except where stated. Never SELECT cron.job.command (may hold a key).
-- Codes only in outputs shared to the public repo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. PRE-RUN (run before create; mirrors PENDING.md pre-run checklist)
-- ---------------------------------------------------------------------------
-- A1. October VDA per-day rate entered (must return 1 row, rate > 0)
select month, year, vda_per_day_rate from payroll_monthly_rates
where month = '10' and year = '2026';

-- A2. No October pay period/run yet (expect 0 rows for runs)
select pr.month, pr.year, r.id, r.status, r.name
from pay_periods pr left join pay_runs r on r.pay_period_id = pr.id
where pr.month = '10' and pr.year = '2026';

-- A3. BUNG: 7 active, all with a salary structure in force on 2026-10-31
select e.emp_code, s.effective_from, s.ot_rate, s.ctc_annual
from employees e
left join employee_salary_structure s
  on s.employee_id = e.id
 and s.effective_from <= date '2026-10-31'
 and (s.effective_to is null or s.effective_to >= date '2026-10-31')
 and not (s.is_active = false and s.effective_to is null)
where e.emp_code like 'BUNG%' and e.is_active
order by e.emp_code;
-- Expect: 7 rows, none with NULL structure fields; BUNG30 ot_rate=100, BUNG33 ot_rate=70.

-- A4. Recurring adjustments active for October (expect >= 1: VFL1567 earning from 2026-10-01)
select e.emp_code, r.kind, r.label, r.amount, r.active_from, r.is_active
from recurring_adjustments r join employees e on e.id = r.employee_id
where r.is_active and r.active_from <= date '2026-10-31'
  and (r.active_to is null or r.active_to >= date '2026-10-01');

-- A5. Every other active employee has a structure in force on 2026-10-31
select e.emp_code from employees e
where e.is_active and e.emp_code not like 'BUNG%'
  and not exists (
    select 1 from employee_salary_structure s
    where s.employee_id = e.id
      and s.effective_from <= date '2026-10-31'
      and (s.effective_to is null or s.effective_to >= date '2026-10-31')
      and not (s.is_active = false and s.effective_to is null));
-- Expect: 0 rows (or only documented holds, e.g. VFL5464 if master still missing).

-- A6. BUNG09 advance: approved, outstanding 6000
select e.emp_code, a.amount, a.monthly_deduction, a.outstanding_balance, a.status
from advance_requests a join employees e on e.id = a.employee_id
where e.emp_code = 'BUNG09';

-- A7. Inactive stay inactive; VFL1520 on_leave (no exit row)
select emp_code, is_active from employees
where emp_code in ('CON16','CON18','CON21','CON22','CON23','VFL1520') order by emp_code;
select e.emp_code, h.status, h.effective_from from employee_status_history h
join employees e on e.id = h.employee_id where e.emp_code = 'VFL1520';
-- Expect: CON* all is_active=false; VFL1520 is_active=true with on_leave from 2026-09-01 and NO 'left' row.

-- ---------------------------------------------------------------------------
-- B. AFTER calculate (run status must be 'calculated')
-- ---------------------------------------------------------------------------
-- B1. Extras landed: employees with extraEarnings in their snapshot
select e.emp_code,
       jsonb_path_query_array(i.snapshot, '$.extraEarnings[*].key') as extra_keys,
       (i.snapshot->>'extraEarningsTotal')::numeric as extra_total
from pay_run_items i
join employees e on e.id = i.employee_id
join pay_runs r on r.id = i.pay_run_id
join pay_periods p on p.id = r.pay_period_id
where p.month = '10' and p.year = '2026' and r.status = 'calculated'
  and i.snapshot ? 'extraEarnings';
-- Expect: VFL1567 with OTHER_ALLOWANCE; BUNG30/33 with BUNG_OT when Kajal entered OT;
--         OUTSTATION_TRAVEL rows for travel days (250 each).

-- B2. VFL1567: allowance inside net, and NOT inside statutory wage bases.
-- Statutory wages are computed app-side as totalEarnings - extraEarningsTotal; verify inputs:
select i.snapshot->>'totalEarnings' as total_earnings,
       i.snapshot->>'extraEarningsTotal' as extra_total,
       i.net_pay
from pay_run_items i join employees e on e.id = i.employee_id
join pay_runs r on r.id = i.pay_run_id join pay_periods p on p.id = r.pay_period_id
where p.month='10' and p.year='2026' and e.emp_code='VFL1567';

-- B3. Held list (must be empty or documented holds only)
select e.emp_code, i.snapshot->'blockers' as blockers
from pay_run_items i join employees e on e.id = i.employee_id
join pay_runs r on r.id = i.pay_run_id join pay_periods p on p.id = r.pay_period_id
where p.month='10' and p.year='2026' and (i.snapshot->>'held')::boolean = true;

-- B4. Worker OT used the flat-VDA-master basis (audit_log records workerOtVdaBasis at calculate)
select new_values->>'workerOtVdaBasis' as ot_basis,
       new_values->>'vdaRatePerDay' as vda_rate,
       new_values->'held' as held_count, new_values->'items' as items
from audit_log where table_name = 'pay_runs' and new_values->>'event' = 'calculate'
order by created_at desc limit 3;
-- Expect ot_basis = 'MASTER_SNAPSHOT' (owner decision 27 Oct 2026).

-- B5. Warnings: every row decided AND AI-reviewed (ready_to_calculate gate already enforced this)
select warning_type, decision, count(*),
       count(*) filter (where decision <> 'pending' and agent_reviewed_at is not null) as reviewed
from pay_run_warnings w join pay_runs r on r.id = w.run_id
join pay_periods p on p.id = r.pay_period_id
where p.month='10' and p.year='2026' group by 1,2 order by 1,2;

-- ---------------------------------------------------------------------------
-- C. AFTER arrears_sep26_30 (Oct only)
-- ---------------------------------------------------------------------------
select count(*) filter (where (i.snapshot->>'arrears_sep26_30')::numeric > 0) as with_arrears,
       sum((i.snapshot->>'arrears_sep26_30')::numeric) as arrears_total
from pay_run_items i
join pay_runs r on r.id = i.pay_run_id join pay_periods p on p.id = r.pay_period_id
where p.month='10' and p.year='2026';

-- ---------------------------------------------------------------------------
-- D. AFTER finalize (status finalized or later)
-- ---------------------------------------------------------------------------
-- D1. Advance recovery fired exactly once: BUNG09 6000 -> 4000
select e.emp_code, a.outstanding_balance, a.status
from advance_requests a join employees e on e.id = a.employee_id
where e.emp_code in ('BUNG09','VFL1567'); -- VFL1567 advance recovers 8000/mo if a run item exists

-- D2. Payslip-ready notifications written for the run's employees (best-effort; count only)
select count(*) from app_notifications n
where n.type = 'payslip_ready' and n.created_at::date >= date '2026-10-27';

-- D3. Final state: exactly one non-cancelled October run, finalized+
select r.name, r.status, (select count(*) from pay_run_items i where i.pay_run_id = r.id) as items
from pay_runs r join pay_periods p on p.id = r.pay_period_id
where p.month='10' and p.year='2026' and r.status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- E. EXPORTS (owner/HR action from the app on the finalized run — record results)
--    salary sheet CSV, bank file CSV, statutory reports: confirm generated and
--    spot-check 2-3 staff PF/ESI/PT against lib/statutory rules. Log the
--    export audit rows here:
select new_values->>'event' as event, new_values->>'items' as items, created_at
from audit_log where table_name='pay_runs' and new_values->>'event' = 'export'
order by created_at desc limit 5;
-- ============================================================================
