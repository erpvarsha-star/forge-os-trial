-- Extraction queries for scripts/payroll-sim-sep2026.ts  (September 2026 gate simulation)
-- READ-ONLY: SELECT only. Run in the Supabase SQL editor or via a read-only MCP session.
-- Deliberately selects NO names, phones, bank, PAN or UAN columns; employee CODES only.
-- Results go into a JSON file OUTSIDE the repo (see the header of payroll-sim-sep2026.ts for its shape).

-- 1. employees: everyone active, plus anyone in the archived September run
select e.emp_code, e.category, e.gender, e.is_active, e.weekly_off_day, e.work_location, e.pt_exempt
from employees e
where e.is_active
   or e.id in (select i.employee_id from pay_run_items i
               join pay_runs r on r.id = i.pay_run_id
               join pay_periods p on p.id = r.pay_period_id
               where p.month = '09' and p.year = '2026' and r.status = 'archived')
order by e.emp_code;

-- 2. live salary masters (money-structure columns only)
select e.emp_code, s.effective_from, s.is_active, s.basic, s.hra, s.conveyance, s.washing, s.education,
       s.heat_allow, s.vda, s.production_allow, s.medical, s.professional_development,
       s.communication, s.uniform, s.ctc_annual, s.rate_type, s.daily_rate
from employee_salary_structure s join employees e on e.id = s.employee_id
order by e.emp_code, s.effective_from;

-- 3. the archived September run (import of the sheet): net, paid days, OT hours, components, deductions
--    (pay_periods.month / year are TEXT, month zero-padded)
select e.emp_code,
       i.snapshot->>'category'                              as category,
       i.net_pay,
       (i.snapshot->>'worked')::numeric                     as worked,
       (i.snapshot->>'otHours')::numeric                    as ot_hours,
       (i.snapshot->>'totalEarnings')::numeric              as total_earnings,
       (i.snapshot->'earnings'->>'OT')::numeric             as ot_pay,
       (i.snapshot->'earnings'->>'BASIC')::numeric          as basic,
       (i.snapshot->'earnings'->>'VDA')::numeric            as vda,
       i.snapshot->'deductions'                             as deductions
from pay_run_items i
join pay_runs r on r.id = i.pay_run_id
join pay_periods p on p.id = r.pay_period_id
join employees e on e.id = i.employee_id
where p.month = '09' and p.year = '2026' and r.status = 'archived'
order by e.emp_code;

-- 4. Not SQL: per-person day counts, OT hours and feeds for the Worker, Consultant and Pune populations
--    are read from the September tabs of the owner's Google Sheets (Worker "Sep 2026", Consultant
--    "Sept 2026", Pune "SEPT") and compared with query 3 for import fidelity.
