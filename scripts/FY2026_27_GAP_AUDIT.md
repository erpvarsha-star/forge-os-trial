# FY2026-27 Gap Audit — sheet data not yet in Supabase (Goal 1, condition 3)
**Scope (owner direction 28 Oct):** Goal 1 closes **salary generation + leave management**.
The pull-in therefore covers payroll, salary masters, advances, leave balances/history.
Production/energy/consumables gaps (marked Goal 2 below) are recorded but not imported under
this goal. Payroll Apr–Sep 2026 is already imported (PATCH_54/55/56 + PATCH_90 archived
runs + PATCH_96/97 repairs) — verify, don't re-import. Pre-April-2026 stays in the sheets
(read-only archive, owner decision 27 Oct).

**Method per sheet:** (1) open the sheet, list tabs; (2) for each tab decide what
uniquely-held data it has for FY2026-27; (3) run the "already in Supabase?" probe;
(4) if probe is empty/mismatch, that's a gap — record it in the table below.

## Already-known state (from repo records — verify live, don't trust)

| Data | Supabase home | Status |
|---|---|---|
| Payroll Apr–Aug 2026 (536 rows, 3 categories) | `payroll_records` | ✅ imported (PATCH_56) |
| September 2026 payroll (sheet amounts) | archived `pay_runs`/`pay_run_items` (PATCH_90) | ✅ seeded |
| Sept consultant OT snapshots (24 items) | `pay_run_items` | ✅ repaired (PATCH_96) |
| Consultant salary masters (12 rows) | `employee_salary_structure` | ✅ PATCH_97 |
| Sept-2026 increments (6 employees) | `employee_salary_structure` new windows | ✅ PATCH_110 |
| BUNG09 advance (₹20k, outstanding ₹6k) | `advance_requests` | ✅ PATCH_110 |
| Employee master (codes, depts, phones) | `employees` | ✅ live (verify vs sheet Master Data) |
| Production records (from 9 Sep) | `production_records`/`form_submissions` | ✅ sync live; **Apr–early-Sep production = likely GAP** |
| Kajal recurring allowance (from Oct) | `recurring_adjustments` | ✅ PATCH_110 |
| Production Apr–early-Sep 2026 | `production_records` | 🔴 **GAP (confirmed)** — sync started 9 Sep; Cutting (`Date\|Machine\|Shift\|VF_No\|Qty`), HT (`Date\|Furnace\|Shift\|Qty`), Final (`Date\|Process\|Shift\|VF_No\|Qty`) tabs hold real rows since 1 Apr that never synced |
| Energy (~25 meters, kWh MTD) + Consumables (Zycril, daily litres) | none — no Supabase table exists | 🔴 **GAP (structure decision first)** — import needs a new table/scope decision (likely Goal 2) |
| Confirmed-days attendance Apr–Aug 2026 (old engine INPUT_ATTENDANCE tabs) | `attendance_records` only from app go-live (Sep) | 🟡 **DECISION** — import daily confirmed attendance Apr–Aug or leave in archive; app monthly views would otherwise start Sept |
| Employee bank details | `employee_salary_structure` | 🟡 partial — CON01/20/21/22/23 blank; **VFL5400 account_no nulled** (float artifact, needs HR re-entry before disbursement); verify CON05/09/12/13/16/18/24 vs passbooks |
| Advance ledger | `advance_requests` | 🟡 7 seeded (PATCH_34) + BUNG09 (PATCH_110) + VFL5324 ₹20k / VFL1556 ₹50k pending HR approval — reconcile against owner's current balance sheet; two advance holders have no employees row (need emp_codes from Yash) |
| Shift times | `shifts` + `plant_config.form_shift_schedule` | 🟡 conflict — sheet shift master (08:30/15:30/23:30, 60-min grace) vs app (07:00/15:30/00:00, 15-min grace since PATCH_38); owner decision required |

## Probe queries (run per sheet row population; codes only in outputs)

```sql
-- Generic presence probe pattern (replace :codes with the sheet's emp codes):
select emp_code, is_active from employees where emp_code in (:codes) order by emp_code;

-- Payroll already imported? (Apr–Sep 2026 archive rows for a code):
select p.month, p.year, count(*) from pay_run_items i
join pay_runs r on r.id = i.pay_run_id
join pay_periods p on p.id = r.pay_period_id
join employees e on e.id = i.employee_id
where e.emp_code = :code and p.year = '2026' and p.month in ('04','05','06','07','08','09')
group by 1,2 order by 1;

-- Advance ledger already in app?
select e.emp_code, a.amount, a.monthly_deduction, a.outstanding_balance, a.status, a.created_at
from advance_requests a join employees e on e.id = a.employee_id
where e.emp_code = :code;

-- Production rows for a month (in-app sync started 9 Sep):
select date_trunc('month', created_at)::date as month, count(*)
from production_records group by 1 order by 1 desc limit 8;
```

## Gap log (fill during the audit — one row per confirmed gap)

| # | Sheet / tab | Data (FY2026-27) | Already in Supabase? (probe result) | Gap? | Import plan (PATCH file #) | Verified after import |
|---|---|---|---|---|---|---|
| 1 | (example) HR OS "Overtime_Form" | Worker OT claims Apr–Aug | `overtime_hours` exists only from app check-ins (Sept+); sheet claims Apr–Aug = TBD | ? | TBD | TBD |

## Sheets to enumerate (from SHEETS_RETIREMENT.md — add any tab not listed)

1. Master "VFL Employee Salary Sheet 2026 Onwards" (Master Data + monthly tabs Apr–Sep+)
2. Attendance sheet (daily P/A, Apr–Oct)
3. "VFPL Pune Home Workers Salary Sheet v1" (masters + Sept tab + Oct entries)
4. "VFL HR OS 2026 27" AND "VFPL Operations Dashboard 2026-27" (Sheet `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY`) — **first confirm whether these are one workbook or two**; enumerate all tabs (Cutting/HT/Final production, Energy, Consumables, Shift master, Supervisor weekly registration, DATA_SUBMISSION_LOG, WEEKLY_PERFORMANCE, FORM_LINKS, ESCALATION_LOG, Overtime_Form ~25k rows, INPUT_*/PAYROLL_* engine tabs)
5. Consultant / Worker / Staff workbooks (monthly tabs FY2026-27)
6. Shift_Planning CSV (rosters — one-off or recurring?)
7. Any advance/loan ledger tab(s) (VFL5324 ₹20k, VFL1556 ₹50k pending HR approval are known open items)

**Exit condition:** every row above answered; gaps imported via additive
`scripts/PATCH_*.sql` files (never re-run imports that already landed); audit
table shows zero confirmed sheet-only gaps for Apr 2026 → audit date.

*Prepared 27 Oct 2026 — awaits Google Drive/Sheets read access + Supabase read access.*
