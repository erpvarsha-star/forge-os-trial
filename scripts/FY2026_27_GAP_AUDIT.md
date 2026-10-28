# FY2026-27 Gap Audit — sheet data not yet in Supabase (Goal 1, condition 3)
**Scope (owner direction 28 Oct):** Goal 1 closes **salary generation + leave management**.
The pull-in therefore covers payroll, salary masters, advances, leave balances/history.
Production/energy/consumables gaps (marked Goal 2 below) are recorded but not imported under
this goal. **FY = April 2026 → today only.** Payroll Apr–Sep 2026 is already imported (PATCH_54/55/56 +
PATCH_90 archived runs + PATCH_96/97 repairs) — verify, don't re-import. Pre-April-2026 stays
in the sheets (read-only archive, owner decision 27 Oct). Departed/inactive people are skipped
per owner direction.

## Method
Sheet side: `.xlsx` exports of every workbook (owner-provided via Drive, folder `D:/kimi/sheets-audit/`,
outside the repo) parsed 28 Oct with three delegated read passes, key figures independently
re-verified. App side: read-only Supabase probes 28 Oct (SELECT only, per owner access mode).

## Already-known state (verified live where marked ✅)

| Data | Supabase home | Status |
|---|---|---|
| Payroll Apr–Aug 2026 (536 rows, 3 categories) | `payroll_records` | ✅ imported (PATCH_56) |
| September 2026 payroll (sheet amounts) | archived `pay_runs`/`pay_run_items` (PATCH_90) | ✅ seeded |
| Sept consultant OT snapshots (24 items) | `pay_run_items` | ✅ repaired (PATCH_96) |
| Consultant salary masters (12 rows) | `employee_salary_structure` | ✅ PATCH_97 |
| Sept-2026 increments (6 employees) | `employee_salary_structure` new windows | ✅ PATCH_110 — **⚠ 14 recent structure rows (incl. increment-era) missing bank fields → PATCH_111 prepared** |
| BUNG09 advance | `advance_requests` | ✅ PATCH_110 (6,000 outstanding, re-verified live) |
| Employee master (codes, depts, phones) | `employees` | ✅ live; **designation/DOJ columns ABSENT (verified) → import candidate** |
| Production records (from 9 Sep) | `production_records`/`form_submissions` | ✅ sync live; Apr–early-Sep = Goal 2, not this goal |
| Kajal recurring allowance (from Oct) | `recurring_adjustments` | ✅ PATCH_110, re-verified live (active) |
| Oct 2026 VDA rate | `payroll_monthly_rates` | ✅ entered (103), re-verified live |
| Oct 2026 pay period/run | `pay_periods`/`pay_runs` | ✅ none exists yet — October is app-only |
| BUNG structures + ot_rate | `employee_salary_structure` | ✅ 7 active; BUNG30=100, BUNG33=70, re-verified live |
| All active non-BUNG have valid structure at 2026-10-31 | — | ✅ verified live (99/99) |
| CON16/18/21/22/23 inactive; VFL1520 on_leave | `employees`/`employee_status_history` | ✅ verified live |
| Leave balances 2026 | `leave_balances` | ✅ 129 rows (PATCH_24 seed) |
| **FY27 leave history** | `leave_requests` | 🔴 **GAP — app has 5 rows vs 659 in sheet (verified live)** |
| UAN/PAN coverage | `employee_salary_structure` | 🟡 106/116 active rows have UAN or PAN |

## Gap log — FY2026-27 AUDIT RESULTS (28 Oct 2026, verified)

| # | Sheet / tab | FY27 data found | Already in Supabase? | Verdict |
|---|---|---|---|---|
| 1 | Master Employee Salary Sheet — Apr–Sep 2026 tabs | monthly payroll | ✅ imported (PATCH_54/56) | verify-only; **Oct 2026 tab does not exist anywhere — October is app-only, intact** |
| 2 | HR OS 2026 27 — EMPLOYEE_MASTER (387 rows) | DOJ (1991–2026, 341 parseable), DESIGNATION, email, category, status | ❌ app has no DOJ/designation columns | **GAP → import (codes + DOJ + designation) — unblocks payslip header** |
| 3 | HR OS — EMPLOYEE_STATUTORY_IDS (329 rows) | UAN 325 / PAN 326 / bank 305 filled | 🟡 partial (verified 106/116 app rows have UAN or PAN) | **GAP → import missing UAN/PAN per code** |
| 4 | HR OS — SALARY_STRUCTURE (125 rows, all EFFECTIVE_FROM 2026-08-01) | component splits | ✅ in app (PATCH_29/110 windows; dates differ — verify on access) | verify-only |
| 5 | HR OS — INPUT_OT (3,706 rows: Sep 3,175 / Oct 531, per OT_DATE) | Sep–Oct 2026 OT per employee per date | 🟡 app derives OT from punches only | September: reconcile vs punches; October: reconcile vs clerk/warnings |
| 6 | HR OS — INPUT_ATTENDANCE (114 rows, 2026-09 only) / INPUT_LEAVE (64 rows, 2026-09 only, CL/EL/SL) | Sep 2026 confirmed days + leave | ✅ Sep archived runs; leave 🟡 | verify-only; **HR OS holds NO Apr–Aug data (MIN_PERIOD=2026-09)** |
| 7 | HR OS — ATTENDANCE_DAILY (3,682 rows: 105 Sep-29, 3,577 Oct 01–27; VFL 2,801 / PUNE 881) | Oct 2026 daily register both sites | 🟡 app has punches + clerk rows | **reconciliation source for the October run (HR-decided deltas live in ATTENDANCE_COMPARISON)** |
| 8 | HR OS — ATT_FORM_PUNE_RAW (175 rows, Oct 01–27, per-employee rows) | Pune form entries | 🟡 app holds Kajal's clerk rows | reconcile Pune Oct: form vs `pune_set_attendance` |
| 9 | Leave Application 2026 — Leave_Applications (659 FY27 rows; **OD 14 / C-off 9 verified live in sheet**; dedicated C-off/OD tabs are empty — they live in the unified form) | leave + OD/C-off history Apr→now | ❌ app has 5 rows | **GAP → import FY27 leave rows incl. OD/C-off; owner decision on OD/C-off paid treatment has real data behind it** |
| 10 | Leave Databases Staff/PW/CON 2026 (497/498/467 rows; monthly availed columns 2026-04→12; DOJ+designation) | FY27 leave allocation + monthly availed | 🟡 app leave_balances seeded from slips (PATCH_24) | **GAP → import availed-by-month to seed app leave_balances properly** (CON allocation column empty) |
| 11 | OT Responses 2026-27 — Form Responses (7,468 rows Apr→Oct 25) + OT_Monthly (Mar–Aug only; Sept absent from summary, raw tab has it) | per-OT-date claims FY27 | ❌ app stores no OT claims | record-only unless audit trail needed; payroll OT already imported Apr–Aug |
| 12 | Pune Home Master Sheet (34 rows: 19 flagged "Active" vs 7 in app) | Pune home-worker masters | 🟡 7 active loaded | **RESOLVED 28 Oct — owner rule: paid in Aug + Sep = active = 7** (no Aug-2026 tab exists; SEPT tab pays exactly the 7). Master's Active flags stale — do not import the other 12. |
| 13 | Pune Home Workers Salary — FY27 tabs Apr–Jul + SEPT; **no Aug 2026 tab** | Pune monthly payroll | ✅ imported per owner process | verify-only; note the missing Aug tab |
| 14 | Waluj Employee Master Data — Staff (135 active/46 non-active; DOJ+designation+bank), Retirement Data (395), Sheet17 (112) | employee master fields | 🟡 app has employees w/o DOJ/designation | same import as #2 (cross-check source) |
| 15 | Salary Slip Generator 2026 (AutoCrat, job "Salary Slip", template reads September 2026) | payslip generation | ✅ app payslips built | **actively used → owner switches to app payslips before this row closes** |
| 16 | Master Leave Computation 2024 | duplicate of Leave_Applications feed | n/a | archive-only, no unique FY27 data |
| 17 | Medicine Issue form (3 rows, dormant since 2024-02) / Contractual Operators (377 rows, 2025-01→2026-09) | medical / contract labour | n/a | parked (medical = future scope; contract labour ≠ employee payroll) |

**Net import list for Goal 1 (payroll+leave):** DOJ+designation (HR OS EMPLOYEE_MASTER, cross-check Waluj Staff), missing UAN/PAN, FY27 leave history incl. OD/C-off, leave allocation/availed by month, + PATCH_111 bank-field backfill (already prepared). All imports skip inactive people. Payroll amounts Apr–Sep: already imported — do not re-import.

## Exit condition
Every row above answered; gaps imported via additive `scripts/PATCH_*.sql` files (never re-run
imports that already landed); audit table shows zero confirmed sheet-only gaps for Apr 2026 → audit date.

*Sheet-side + app-side audit COMPLETE 28 Oct 2026. Awaiting: human review/run of PATCH_111; owner decisions (OD/C-off paid treatment, bank-details maintenance path, export layout, shift-time conflict); October run by owner/HR after 31 Oct with stage verification via OCT2026_RUN_VERIFICATION.sql.*
