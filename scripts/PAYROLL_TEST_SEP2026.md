# First real pay-run test — September 2026 (stop at `calculated`)

Prepared 20 Oct 2026. Yash triggers the calls with his own login; nothing goes past `calculated`.

## Call
POST https://odfwtdpvpfzdrznvurru.supabase.co/functions/v1/payroll-run
Headers: `Authorization: Bearer <your session access token>`, `apikey: <publishable anon key>`, `Content-Type: application/json`

## Bodies, in order (send each once)
1. `{ "action": "create", "month": 9, "year": 2026, "name": "2026-09 TEST calc check" }` → returns `payRunId`
2. `{ "action": "calculate", "payRunId": "<PAY_RUN_ID>" }` → run becomes `calculated` (no `force` needed: Sept feeds are empty)
3. `{ "action": "summary", "payRunId": "<PAY_RUN_ID>" }`

Do NOT send: any `transition` (approved/finalized), or `arrears_sep26_30` (October only).
`create` is not idempotent — calling it twice makes a second draft run.

## Expected differences vs the sheet (not engine bugs)
- Paid days: app attendance for Sept is test-period data (from ~24 Sep).
- Workers: efficiency feed empty → production allowance 0 + EFFICIENCY_MISSING warning (archived has 8500 + PROD_OFFSET).
- Worker OT uses the current VDA basis.
- Coverage: engine uses current `employees`; archived Sept has 101 incl. people since deactivated; held = missing salary master.
Compare structure (gross, PF, ESI, PT, OT) on matching inputs, not net-for-net.

## Comparison (SQL Editor, after calculate)
```sql
with arch as (
  select i.employee_id, i.net_pay, i.snapshot s
  from pay_run_items i join pay_runs r on r.id=i.pay_run_id join pay_periods p on p.id=r.pay_period_id
  where p.month='09' and p.year='2026' and r.status='archived'),
tst as (
  select i.employee_id, i.net_pay, i.snapshot s
  from pay_run_items i join pay_runs r on r.id=i.pay_run_id join pay_periods p on p.id=r.pay_period_id
  where p.month='09' and p.year='2026' and r.name ilike '%TEST%' and r.status not in ('archived','cancelled'))
select e.emp_code, e.name, e.category,
 a.net_pay archived_net, t.net_pay test_net,
 round(coalesce(t.net_pay,0)-coalesce(a.net_pay,0),2) diff,
 (a.s->>'totalEarnings')::numeric a_gross, (t.s->>'totalEarnings')::numeric t_gross,
 (a.s->>'worked')::numeric a_paid_days,    (t.s->>'worked')::numeric t_paid_days,
 (a.s->'earnings'->>'BASIC')::numeric a_basic, (t.s->'earnings'->>'BASIC')::numeric t_basic,
 (a.s->'deductions'->>'PF')::numeric a_pf,  (t.s->'deductions'->>'PF')::numeric t_pf,
 (a.s->'deductions'->>'ESI')::numeric a_esi,(t.s->'deductions'->>'ESI')::numeric t_esi,
 (a.s->'earnings'->>'OT')::numeric a_ot,    (t.s->'earnings'->>'OT')::numeric t_ot,
 case when a.employee_id is null then 'only in TEST'
      when t.employee_id is null then 'only in ARCHIVED' else 'both' end side
from arch a full join tst t on t.employee_id=a.employee_id
join employees e on e.id=coalesce(a.employee_id,t.employee_id)
order by abs(coalesce(t.net_pay,0)-coalesce(a.net_pay,0)) desc, e.emp_code;
```

```sql
with arch as (
  select distinct i.employee_id from pay_run_items i join pay_runs r on r.id=i.pay_run_id join pay_periods p on p.id=r.pay_period_id
  where p.month='09' and p.year='2026' and r.status='archived'),
tst as (
  select distinct i.employee_id from pay_run_items i join pay_runs r on r.id=i.pay_run_id join pay_periods p on p.id=r.pay_period_id
  where p.month='09' and p.year='2026' and r.name ilike '%TEST%' and r.status not in ('archived','cancelled'))
select count(*) filter (where a.employee_id is not null) archived_emps,
 count(*) filter (where t.employee_id is not null) test_emps,
 count(*) filter (where a.employee_id is not null and t.employee_id is not null) in_both,
 count(*) filter (where t.employee_id is null) only_archived,
 count(*) filter (where a.employee_id is null) only_test
from arch a full join tst t on t.employee_id=a.employee_id;
```

## Cleanup later (not part of the test)
calculated → draft → cancelled through `transition`, once the comparison is done.
