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

**Net import list for Goal 1 (payroll+leave):** DOJ+designation (HR OS EMPLOYEE_MASTER, cross-check Waluj Staff), missing UAN/PAN, FY27 leave history + leave allocation/availed by month — **leave scope = staff + workers only (consultants/BUNG excluded per owner 28 Oct), reconciled against payroll Apr→date per emp ID, balance + utilization + applications only, NO payment transactions; leave window = Jan 2026 → today (Jan–Mar 2026 = prior-period utilization affecting opening balances); ALL leave-sheet-vs-salary-sheet mismatches HIGHLIGHTED in a gaps report for HR/owner — never auto-resolved** — + PATCH_111 bank-field backfill (already prepared). All imports skip inactive people. Payroll amounts Apr–Sep: already imported — do not re-import.

## Exit condition
Every row above answered; gaps imported via additive `scripts/PATCH_*.sql` files (never re-run
imports that already landed); audit table shows zero confirmed sheet-only gaps for Apr 2026 → audit date.

*Sheet-side + app-side audit COMPLETE 28 Oct 2026 (statuses refreshed 29 Oct: PATCH_111 and PATCH_113 applied, bank-details path built, OD/C-off paid mapping deferred to the November review). Awaiting: owner decisions (export layout, shift-time conflict); October run by owner/HR after 31 Oct with stage verification via OCT2026_RUN_VERIFICATION.sql.*


## Full-schema inventory (28 Oct, read-only) — 78 tables enumerated

**Salary-front state, live-verified:**
| Area | Tables | State |
|---|---|---|
| People + masters | employees (154), employee_salary_structure (121), salary_change_requests (3 pending) | ✅ in line (PATCH_111 bank fix APPLIED 29 Oct) |
| Pay runs | pay_periods (6 = Apr–Sep), pay_runs (24 archived), pay_run_items (652), pay_run_warnings (0 — no Oct run yet) | ✅ in line |
| Payroll history | payroll_records (536 = Apr–Aug import), payroll_monthly_rates (1 = Oct 103) | ✅ in line |
| Extras / recurring | recurring_adjustments (1 = Kajal, active) | ✅ in line |
| Advances | advance_requests (10), advance_recoveries (0 — fires at finalize) | ✅ in line |
| Attendance | attendance_records (2,526, current to today), employee_shifts (7,750), shifts (9) | ✅ in line |
| Statutory config | efficiency_incentive_slabs (5), pt_slabs (5) | ✅ seeded |
| **Feeds for October run** | payroll_canteen_entries / payroll_society_recoveries / payroll_efficiency_entries / payroll_adjustments — **ALL 0 ROWS** | 🟠 empty by design (HR/plant-head must enter Oct feeds before calculate; worker production allowance = 0 + missing_efficiency warnings until the efficiency % is entered) |
| **Leave** | leave_requests (5 vs 659 in sheet), leave_balances (129 = seed), **comp_off_balance (table EXISTS, 0 rows)** | 🔴 import pending; comp-off already has a landing table |
| **Schema gaps** | designation / date_of_joining ABSENT; public_holidays (table EXISTS, 0 rows) | 🔴 import needs ADD COLUMN; holidays need entry if used |
| Legacy / parked | salary_advances (0, orphan — documented), worker_efficiency_actuals (0, superseded), attendance_regularisation / attendance_warnings / role_kpis / role_kras (0, future scaffolding) | ⚪ no action |

**Verdict: the salary front is in line for the October run** — engine, lifecycle, masters, advances, statutory config, archived history all verified. Remaining before/around the run: (1) ~~PATCH_111 human-run~~ done 29 Oct; (2) HR enters October feeds (efficiency % is the critical one); (3) leave import build (on owner word); (4) DOJ/designation + UAN/PAN import files; (5) owner decisions (OD/C-off paid mapping DEFERRED to the November review of the October calculation; bank path settled 29 Oct; export layout; shift conflict).

## October runbook + owner process decisions (28-29 Oct)
- **Payslips Apr–Sep: ALREADY LIVE in-app** (verified 28 Oct: all 24 runs archived incl. 4 September population runs; `my_payslips()` serves them). No push needed for visibility; retroactive payslip_ready bell rows = optional one-off patch, owner decision.
- **Canteen/society/efficiency for October: enter IN APP** (recommended, awaiting owner confirm) — HR Payroll Feeds + plant-head Efficiency; data arrives by 5 Nov. HR OS = read-only fallback record. BUNG02/06 deductions also via app adjustments.
- **SETTLED 29 Oct: BUNG release is via the per-category PUNE_STAFF run (PATCH_112/payroll-run v9), verified Kajal → HR → accounts, ~2 Nov; the options below are historical.** BUNG early release 2 Nov: lifecycle constraint flagged — finalize locks the whole October run permanently, so finalizing on 2 Nov would freeze staff/worker items without feeds. Options: (a) verified preview figures on 2 Nov, bank release with everyone ≥5 Nov (recommended); (b) manual BUNG payment as documented exception, reconciled against the formal run. Owner to pick.
- **No unexplained gaps in salary sheets** beyond the resolved Pune-Aug absence. Known gap list unchanged (leave import, OD/C-off, DOJ/designation, bank fields, UAN/PAN).
- **Per-person leave balance table = the leave-import build** (spec locked); not yet generated.

## Cross-assistant coordination state (29 Oct)
- **LIVE (verified by Kimi Code read-only 29 Oct):** PATCH_112 applied (`pay_runs.population` present, 24 historical runs NULL) · payroll-run v9 deployed (unauth call → 401; hash match verified by Claude) · `comp_off_balance` confirmed a per-earning LEDGER (employee_id, earned_date, expiry_date, is_used, used_in_leave_request_id — no quantity column, so 1 row = 1 day).
- **REPO BASE now carries the corrected patch copies** (PR #37 merged 29 Oct): PATCH_111 staging table gets RLS + API-grant revoke + comma-FROM UPDATE fix (the JOIN-on-target form errors 42P01); PATCH_113 drops the 3-arg review_leave_request before the 4-arg create (prevents PGRST203 ambiguity for apk-106 callers) + COFF branch documented as KNOWN GAP.
- **UPDATED 29 Oct: both are now APPLIED** (PATCH_111 29 Oct, 1 newer row filled, staging dropped; PATCH_113 29 Oct with a ledger-aware comp-off branch; PATCH_114/115/116 built: HR Bank Details + Half-day Comp-off screens, owner review screen, audit masking). Historical text follows. PATCH_111 (needs the private values file at D:/kimi/sheets-audit/_patch111_values.sql — owner pastes STEP 2) · PATCH_113 (owner decision pending on the comp-off ledger draw rule).
- **DECIDED 29 Oct (owner): whole-day C-off draws oldest-unexpired-unused ledger rows; whole-day shortfall is BLOCKED (not allowed-with-warning); half-day C-off is never auto-consumed, HR decides and the owner reviews decided ones. OD/C-off paid-day mapping in the payroll feed is DEFERRED to the November review.** Original recommendation:  consume oldest-unexpired-unused rows first, 1 row = 1 whole day; half-day C-off: v1 block (request whole days) or consume 1 row and record 0.5 in leave_consumption — owner picks; shortfall (granted > unused rows): allow with warning, paid per grant (sheet-consistent), HR trues the ledger later.
- **RESOLVED 29 Oct: PATCH_113 is live and the APK workflow is re-enabled (apk-111/112 published).** Historical risk note: the merged leave UI calls p_granted_days / consume_leave_for_request which exist only after PATCH_113 — the Build Android APK workflow should stay DISABLED until 113 is applied (next APK would break leave approvals). apk-106 predates the leave code and is unaffected.
