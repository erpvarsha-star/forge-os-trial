# Forge OS — Google Sheets Retirement Checklist
**Goal 1 artifact (app = sole source of truth).** One row per sheet/process. A row is
done only when all three states are ticked and the owner/HR confirms real use.
Codes only — no names or pay figures in this public repo.

**Scope bands (owner direction 28 Oct 2026):**
- **P0 — this goal: close salary generation + leave management.** Rows 1, 2, 3, 5, 6, 7, 8, 9, 12, 13, 15, 19 (salary master → workbooks → payroll engine → bank file → advances, plus attendance feeds, OT/efficiency, shifts, leave/advance requests + balances). The October run is the proof.
- **Parked — Goal 2 (KPI/performance module) or later: the operations sheets.** Rows 4, 16, 17, 18 (production/ops dashboard, energy, consumables, shift-master conflict, form registry, supervisor registration) and row 14 (ALERT.gs/AttendanceReport.gs digest). Do not spend Goal-1 effort here; the ops sheet stays alive for these tabs until Goal 2.

Status legend: ✅ in-app replacement live · 🟡 partial / in-flight · ⬜ not started

| # | Sheet / process | What it holds | In-app replacement | Remaining to retire |
|---|---|---|---|---|
| 1 | Master "VFL Employee Salary Sheet 2026 Onwards" | Staff/worker masters, increments | ✅ `employee_salary_structure` (+ effective windows), salary-change request → approval chain, bulk salary CSV (owner) | HR maintains masters in-app only; owner confirms; sheet becomes read-only archive |
| 2 | Attendance sheet (daily) | Daily P/A per employee | ✅ GPS/QR check-in, Pune clerk screen (`pune_set_attendance`), Late Comers Review, `daily_attendance_report` + `monthly_attendance_summary` views | HR confirm app attendance is the record of entry; stop sheet writes |
| 3 | Pune BUNG sheet ("VFPL Pune Home Workers Salary Sheet v1") | BUNG masters, OT, manual deductions/allowances | ✅ BUNG = `PUNE_STAFF` routing, `ot_rate`, clerk OT/travel entry, `recurring_adjustments` | BUNG02/06 deductions via approved adjustments (per month, not recurring); owner confirms gross masters match sheet |
| 4 | "VFL HR OS 2026 27" ops dashboard + Code.gs ⚠ *verify whether "VFPL Operations Dashboard 2026-27" (Sheet `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY`, active 12 Aug) is the same workbook or a second one* | Production records (Cutting/HT/Final tabs, rows since 1 Apr), form submissions, DATA_SUBMISSION_LOG | 🟡 `form_submissions` + `production_records` landing tables sync live (9 Sep); plant HTML dashboard | **Blocked by Goal 2** — daily production entry must happen in-app before this sheet can retire. Also: (a) Netlify dashboard's production card must read `production_records` directly instead of `APPS_SCRIPT_URL`; (b) energy + consumables tabs have NO app equivalent (row 16); (c) VMC has no RAW tab on the sheet either — parity, not a gap |
| 5 | Overtime form (tab in HR OS sheet, ~25k rows) | Worker OT claims | ✅ `attendance_records.overtime_hours` (checkout-derived) + Pune `ot_hours` via clerk | Owner confirm no new OT rows written to sheet |
| 6 | Worker Monthly Efficiency form (Fazal, due 5th) | Monthly efficiency % | ✅ `payroll_efficiency_entries` + plant-head screen + approval + reminder cron (PATCH_87) | Fazal enters in-app for a real month; form closed |
| 7 | Shift_Planning_1.csv | Weekly shift rosters, 8 allocator groups | ✅ `shift_allocator_id`, `allocate_team_shift_week`, allocator screens, HR master screen | HR plan shifts in-app for a real week; CSV frozen |
| 8 | Leave Application / Advance Application forms | Leave + advance requests | 🟡 In-app staged approval chains live (PATCH_53); TwoStepFormModal still opens the Google Form as step 2 | Prove in-app flow bug-free, then drop the Google Form step (owner decision) |
| 9 | Leave/Advance tracking in sheets | Balances, approvals | ✅ `leave_balances`, `leave_requests`, `advance_requests`, advance-ledger screen | HR confirm; stop sheet tracking |
| 10 | MRM review sheet | Monthly manager reviews | ✅ `(manager)/mrm.tsx` submission + plant-head status screen | Managers submit in-app; sheet closed |
| 11 | 5S sheet | Daily 5S checks | ✅ In-app daily 5S challenge + photo submission | Owner confirm |
| 12 | Consultant / Worker / Staff monthly workbooks | Monthly payroll computation | ✅ `payroll-run` engine + run lifecycle + salary-sheet/bank-file/statutory exports | **October 2026 run fully in-app = the proof row** (see PENDING.md pre-run checklist) |
| 13 | Salary disbursement / bank upload sheet | Bank file | ✅ Bank-file CSV export (old-sheet column names) from finalized runs | One real upload from an app export; sheet closed |
| 14 | ALERT.gs / AttendanceReport.gs (Apps Script) | Shift alerts, daily attendance email/Sheet digest | 🟡 In-app notifications + push + SQL views replace the need; email digest optional (Gmail connector, on-demand) | Owner decision: keep or drop the daily email; never re-paste AttendanceReport.gs going forward |
| 15 | Advance balance sheet | Advance ledger | ✅ `advance_requests` + `advance-ledger.tsx` + auto recovery at finalize | HR reconcile sheet balances against `advance_requests` (7 seeded PATCH_34 + BUNG09 PATCH_110 + VFL5324/VFL1556 pending approval), then confirm; sheet closed |
| 16 | Ops dashboard tabs: Energy (~25 meters, kWh MTD) + Consumables (Zycril mixing, daily litres) | Energy + consumables tracking | ⬜ none — the 9 Sep sync never covered these | Owner decision: build in-app (likely Goal 2 KPI scope) or leave in archive; until then this sheet stays live for these two tabs |
| 17 | Ops dashboard tabs: Shift master + Supervisor weekly registration (Telegram chat IDs) + WEEKLY_PERFORMANCE + FORM_LINKS + ESCALATION_LOG | Shift times, supervisor registration, weekly perf, form routing, alert log | 🟡 app `shifts` + shift screens; weekly perf = Goal 2; FORM_LINKS → `form_links` (PATCH_14/19); Telegram registration retires with ALERT.gs | ⚠ **Conflict to resolve**: sheet shift master says S1 08:30/S2 15:30/S3 23:30 (60-min grace) but app shifts were re-confirmed 24 Sep as 07:00/15:30/00:00 (15-min grace, PATCH_38) — owner must confirm the app times are the real ones before the sheet freezes |
| 18 | Form registry sheet (`1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554`) + per-shop Google Forms + "VFPL Factory OS — Supervisor Data Entry (Dynamic)" form | Which forms exist, who fills them | 🟡 `form_links` table seeded from it; Forms tab renders it | Registry maintenance moves in-app (form_links edits); `resolveFormSheets.gs` 22/28 NO MATCH must be fixed first or the registry is stale; 5 placeholder form URLs (Leave/Advance/Gate Pass/Cash Expenses/Hospital, PATCH_41/42) still need real links from Yash |
| 19 | Old sheet-side payroll engine tabs (INPUT_ATTENDANCE / INPUT_OT / INPUT_EFFICIENCY / PAYROLL_PERIOD / STATUTORY_CONFIG / PAYROLL_DRAFT → PAYROLL_STAFF / PAYROLL_WORKER), driven by `VFPL_Payroll_Engine_24Sep2026.gs` | Confirmed-days + OT + efficiency inputs and draft payroll per month | ✅ app feed tables (`payroll_canteen_entries`/`payroll_society_recoveries`/`payroll_efficiency_entries`/`payroll_adjustments`/`payroll_monthly_rates`) + `payroll-run` + warnings | October run (row 12) proves the replacement; then the .gs engine is retired and never re-pasted. The 24 Sep "dual input path + consolidated sheet" plan was **superseded by the owner's 26 Oct app-only decision** — do not build it |

## Cross-cutting prerequisites
- [ ] **Access**: Supabase (verify live state per row) + read-only Google Drive/Sheets (enumerate any sheet not listed above — incl. confirming whether "VFPL Operations Dashboard 2026-27" and "VFL HR OS 2026 27" are one workbook or two; audit FY2026-27 gaps). Requested from owner.
- [ ] **APK release**: several rows need shop-floor/Kajal device confirmation → blocked until owner re-enables the build workflow.
- [ ] **FY2026-27 pull-in audit**: prepared in `scripts/FY2026_27_GAP_AUDIT.md` (known-state table, probe queries, gap log); run once access lands.
- [ ] **October run verification**: prepared in `scripts/OCT2026_RUN_VERIFICATION.sql` (pre-run → post-calculate → arrears → finalize → exports); run per stage once the run starts.
- [ ] **`scripts/MigrateToSupabase.gs` must stay UNINSTALLED** — it pushes the Employee Master Sheet into `employees`; installing it would make the sheet a second write path again. App is the only write path going forward.
- [ ] **Placeholder Google Form URLs** (PATCH_41/42) need real links from Yash before the Forms tab can stand alone.

## Sheet file IDs / links (collect — needed to run the audit and confirm retirement)
| Sheet / file | ID / link | Status |
|---|---|---|
| Form registry ("which forms exist" sheet) | `1M2E83q64BXzfGwZsNQ_9u2jdfzwJPrJlD8WKRKgG554` | known (from PENDING.md) |
| "VFPL Operations Dashboard 2026-27" | `1GHdhrRtOhQFshsAOCK4n3GiJp-6a03k8bn0V_M04wSY` | known (parked, Goal 2) |
| Master "VFL Employee Salary Sheet 2026 Onwards" | — | **needed** |
| Consultant / Worker / Staff workbooks | — | **needed** (3+ files) |
| Attendance sheet | — | **needed** |
| "VFPL Pune Home Workers Salary Sheet v1" | — | **needed** |
| "VFL HR OS 2026 27" (if distinct from ops dashboard) | — | **needed** |
| Shift_Planning_1.csv | — | **needed** |
| Bank-upload / disbursement sheet | — | **needed** |
| Advance balance sheet | — | **needed** |

Per sheet, one line on who writes in it today and how often is enough — most of the "what happens" is already captured in CLAUDE.md/PENDING.md; the links are for verification and the final "writes stopped" check.

## P0 code findings from leave-closure audit (28 Oct 2026)
- 🔴 **OD / COFF are paid-day holes in the payroll feed.** DB allows leave types EL/CL/SL/LWP/COFF/OD (PATCH_28), but the app leave form offers only EL/CL/SL/LWP (`constants/index.ts` LEAVE_TYPES), and `feedSync` counts only EL/CL/SL from approved leave. An approved **OD** (outdoor duty — by definition no plant check-in, so no attendance row) or **COFF** (compensatory off) silently counts as an unpaid day in the October run. Needs: (1) owner decision — are OD/COFF paid? (2) if yes, a `feedSync` mapping (source-of-truth file, not frozen — legal to change) + re-vendor + regression/test update; the engine's unused `plo` bucket may fit OD.
- 🟡 **Leave form parity**: COFF/OD not selectable in-app, so if they're real categories HR must enter them via SQL today — check live `leave_requests` for existing COFF/OD rows once Supabase access lands.
- ✅ Confirmed sound: EL/CL/SL add-days-without-attendance-rows logic, LWP correctly unpaid, staged chains (PATCH_53) frozen and code-verified earlier, `leave_balances` seeded (PATCH_24).

## P0 code findings from advance/bank-file closure audit (28 Oct 2026)
- 🔴 **No in-app path to maintain bank details.** `employee_salary_structure.bank_name/account_no/ifsc` have no entry screen: the new-hire/salary-change breakup form (PATCH_46 fields + `SalaryBreakupFields.tsx`) has no bank fields, and the owner bulk-salary CSV deliberately excludes them (PATCH_99). Owner has been entering banks via direct SQL (consultants, 21 Oct). Closing the bank-upload sheet (row 13) needs an owner decision: build a small owner/hr_admin bank-details screen (table is already restricted to those two roles) or accept dashboard edits as the process.
- 🟡 **Bank export picks the NEWEST structure row by `effective_from`** (payroll-run export action). The Sept-2026 increment rows (PATCH_110) and VFL5464's new row were built by the owner's tool — if any was inserted without bank columns, those employees' bank-file cells go blank in the October export even though an older row has the data. Live check queued (first Supabase access): bank columns present on every structure row with `effective_from >= 2026-07-26` for employees who have older rows with banks.
- 🟡 **VFL5324 (₹20k) and VFL1556 (₹50k) advances still pending HR approval**; VFL1556's "10000 months" entry is a typo needing intent confirmation (brief §7) — HR action before finalize so the ledger matches the sheet one last time.
- ✅ Confirmed sound: `apply_advance_recoveries` (PATCH_103) takes `least(remaining, monthly_deduction, outstanding_balance)` per advance, idempotent per (run, advance), decrements `outstanding_balance` at finalize; feedSync's calculate-time deduction uses the same cap — BUNG09 math verified consistent (6000 → 4000 at October finalize).

## P0 code findings from salary-export closure audit (28 Oct 2026)
- 🟡 **Salary-sheet CSV layout is generic, not a workbook mirror.** `buildSalarySheetCsv` emits a union-of-earnings/deduction-keys layout; the owner's Staff/Worker/Consultant workbooks have fixed per-category columns HR is used to reading. Owner confirms the generic layout is acceptable for retirement (codes only either way) or asks for per-category layouts before row 12 closes.
- 🟡 **Statutory formats unverified against official validators** — PF ECR (`#~#`), ESI CSV, PT CSV, MLWF were built to spec but never run through EPFO/ESIC validation; CA review needed before any real filing (known since 25 Oct, reaffirmed here because row 12's closure includes statutory exports).
- ✅ Confirmed sound: bank file mirrors the old sheet's exact columns (EMP_ID/EMPLOYEE_NAME/BANK_NAME/BANK_ACCOUNT/IFSC/NET_PAY, owner decision 21 Oct); CSV is formula-injection-safe; held/zero-net employees are excluded from the bank file; salary-window `pickSalary` + increment-date fix verified earlier; payslip extras and recurring-adjustment paths code-verified.

*Last updated: 28 Oct 2026 — scope bands per owner direction; P0 leave, advance/bank and export audits complete; not yet owner-reviewed.*
