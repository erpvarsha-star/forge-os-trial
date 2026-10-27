# September 2026 payroll gate: re-run report (repo-safe)

Run 27 Oct 2026. Offline, read-only. Runners: `scripts/payroll-sim-sep2026-rerun-staffwork.ts` and `scripts/payroll-sim-sep2026-rerun-consbung.ts` (both read a data JSON path from argv; no data is in the repo). Supersedes the 26 Oct report `PAYROLL_SIM_SEP2026_RESULTS.md` (verdict FAIL).
This file holds employee codes, counts, tolerance, month lengths and rupee deltas below 50 only. Per-person amounts stay in the scratchpad detail files, not in the repo.

## (a) Owner decisions of 27 Oct 2026 applied in this re-run

- Tolerance is Rs 50 (was Rs 2). A person passes if the engine net is within 50 of the sheet, or the gap is explained by a documented frozen rule or an owner-documented exception.
- Worker OT basis: OT rate = 2 x (basic + flat VDA master) / working days / 8, with VDA earnings = the current per-day rate x present days.
- Consultant sheet rule: daily-rate consultants are paid rate x worked days (weekly offs counted) plus OT; monthly consultants are prorated on the sheet's 31-day basis.
- The 6 disputed salary masters (VFL1389, VFL1556, VFL1566, VFL5322, VFL5442, VFL5464) are resolved (data fix, finding 1).
- VFL1463 is closed as an owner-documented exception (repayment of an owner-stated amount lowers the app net by that amount).
- BUNG09 advance: the September sheet already contains the recovery; the app also recovers it from the live approved advance.
- VFL1520 is on leave: zero days, zero net.
- Pune manual items (allowances, flat per-hour OT) are documented exceptions, not engine inputs.

## (b) Per-population result

| population | in scope | exact | PASS_U2 | PASS_EXCEPTION | OPEN | FAIL | held |
|---|---:|---:|---:|---:|---:|---:|---:|
| STAFF | 71 | 0 | 69 | 1 | 1 | 0 | 0 |
| PERMANENT_WORKER | 19 | 19 | 0 | 0 | 0 | 0 | 0 |
| CONSULTANT | 7 | 3 | 4 | 0 | 0 | 0 | 0 |
| PUNE_STAFF | 7 | 3 | 0 | 4 | 0 | 0 | 0 |

Not in the counts: VFL1520 (staff, on_leave), and 5 inactive consultants (CON16, CON18, CON21, CON22, CON23), which are not in any run. Consultant row counts the 7 active people.

Class key. exact: within the tolerance on raw sheet days. PASS_U2: fails on raw days only because the sheet uses a 31-day basis in a 30-day month; clears when days and OT are aligned to 31. PASS_EXCEPTION: gap equals an owner-documented exception. OPEN: unexplained. For STAFF, "exact 0" is because every staff row is on the 31-day sheet basis (U2).

## (c) Per-code result

Deltas shown are net (engine minus sheet) in rupees. Any delta with absolute value of 50 or more is replaced by words.

| code | population | class | delta (rupees) | note |
|---|---|---|---|---|
| VFL1064 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1066 | STAFF | PASS_U2 | 0.49 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1272 | STAFF | PASS_U2 | -0.72 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1290 | STAFF | PASS_U2 | 0.2 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1327 | STAFF | PASS_U2 | -0.97 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1386 | STAFF | PASS_U2 | -3 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; residual is rounding of the basic/0.40 gross rule |
| VFL1389 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL1391 | STAFF | PASS_U2 | -0.35 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1446 | STAFF | PASS_U2 | -2.18 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; residual is rounding of the basic/0.40 gross rule |
| VFL1450 | STAFF | PASS_U2 | 0.4 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1453 | STAFF | PASS_U2 | 1.67 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1463 | STAFF | PASS_EXCEPTION | residual +1 after owner-stated repayment | raw delta large, equals the owner-stated repayment amount (documented exception); residual is within tolerance after the 31/30 alignment |
| VFL1482 | STAFF | PASS_U2 | 0.07 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1516 | STAFF | PASS_U2 | -0.19 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1527 | STAFF | PASS_U2 | -2.61 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; residual is rounding of the basic/0.40 gross rule |
| VFL1528 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1543 | STAFF | PASS_U2 | -0.8 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1545 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1549 | STAFF | PASS_U2 | -0.28 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1556 | STAFF | PASS_U2 | 0.21 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL1557 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1560 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1562 | STAFF | PASS_U2 | -0.92 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1564 | STAFF | PASS_U2 | -0.08 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1566 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL1567 | STAFF | OPEN | large, equals the unexplained manual amount | recurring positive Other Allowance in the sheet; engine has no positive-earnings input; source unexplained |
| VFL4057 | STAFF | PASS_U2 | -0.44 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5079 | STAFF | PASS_U2 | 0 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5237 | STAFF | PASS_U2 | 0.68 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5272 | STAFF | PASS_U2 | 0.46 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5273 | STAFF | PASS_U2 | 0.53 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5302 | STAFF | PASS_U2 | -0.13 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5303 | STAFF | PASS_U2 | 1.15 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5318 | STAFF | PASS_U2 | 1.75 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5321 | STAFF | PASS_U2 | -0.16 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5322 | STAFF | PASS_U2 | 0.45 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL5324 | STAFF | PASS_U2 | -0.19 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5347 | STAFF | PASS_U2 | -1.97 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5379 | STAFF | PASS_U2 | -0.8 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5382 | STAFF | PASS_U2 | -0.22 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5397 | STAFF | PASS_U2 | -1.35 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5399 | STAFF | PASS_U2 | 0.28 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5400 | STAFF | PASS_U2 | -0.32 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5405 | STAFF | PASS_U2 | -0.54 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5409 | STAFF | PASS_U2 | -1.79 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5413 | STAFF | PASS_U2 | -0.22 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5430 | STAFF | PASS_U2 | 0.04 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5433 | STAFF | PASS_U2 | 2.05 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; residual is rounding of the basic/0.40 gross rule |
| VFL5434 | STAFF | PASS_U2 | 0.49 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5439 | STAFF | PASS_U2 | -1.03 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5440 | STAFF | PASS_U2 | -0.01 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5442 | STAFF | PASS_U2 | -0.59 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL5444 | STAFF | PASS_U2 | -1.33 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5446 | STAFF | PASS_U2 | -1.56 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5447 | STAFF | PASS_U2 | -0.93 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5448 | STAFF | PASS_U2 | 1.65 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5449 | STAFF | PASS_U2 | 1.89 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5450 | STAFF | PASS_U2 | -1.8 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5451 | STAFF | PASS_U2 | -1.7 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5452 | STAFF | PASS_U2 | -1.72 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5454 | STAFF | PASS_U2 | -0.99 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5457 | STAFF | PASS_U2 | 0.34 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5458 | STAFF | PASS_U2 | 1.5 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5459 | STAFF | PASS_U2 | -3.48 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; residual is rounding of the basic/0.40 gross rule |
| VFL5460 | STAFF | PASS_U2 | -0.68 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5461 | STAFF | PASS_U2 | -2 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5462 | STAFF | PASS_U2 | 0.56 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5463 | STAFF | PASS_U2 | 0.44 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5464 | STAFF | PASS_U2 | 1 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31; master resolved by the 27 Oct data fix |
| VFL5465 | STAFF | PASS_U2 | -1.11 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL5466 | STAFF | PASS_U2 | -0.79 | raw delta = 31/30 effect (sheet 31-day basis); delta shown is after aligning days to 31 |
| VFL1520 | STAFF | NOTE (not in the 71) | n/a | on_leave, zero days, zero net, eligible-not-held; not in the September sheet |
| VFL4008 | PERMANENT_WORKER | PASS_EXACT | 0.05 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4011 | PERMANENT_WORKER | PASS_EXACT | 0.01 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4012 | PERMANENT_WORKER | PASS_EXACT | 0.21 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4024 | PERMANENT_WORKER | PASS_EXACT | 1.41 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) ; U5 manual exception in the sheet, passes without it |
| VFL4025 | PERMANENT_WORKER | PASS_EXACT | 1.14 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4026 | PERMANENT_WORKER | PASS_EXACT | 0.73 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4032 | PERMANENT_WORKER | PASS_EXACT | 0.01 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4033 | PERMANENT_WORKER | PASS_EXACT | -0.71 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) ; U5 manual exception in the sheet, passes without it |
| VFL4036 | PERMANENT_WORKER | PASS_EXACT | 0.03 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4041 | PERMANENT_WORKER | PASS_EXACT | 0.31 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4042 | PERMANENT_WORKER | PASS_EXACT | 0.15 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4043 | PERMANENT_WORKER | PASS_EXACT | 0.82 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4045 | PERMANENT_WORKER | PASS_EXACT | 0.64 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4063 | PERMANENT_WORKER | PASS_EXACT | 0.38 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4065 | PERMANENT_WORKER | PASS_EXACT | 0.7 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4066 | PERMANENT_WORKER | PASS_EXACT | -0.1 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4068 | PERMANENT_WORKER | PASS_EXACT | 0.74 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4071 | PERMANENT_WORKER | PASS_EXACT | 0.75 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| VFL4072 | PERMANENT_WORKER | PASS_EXACT | 0.42 | passes only with workerOtVdaBasis=MASTER_SNAPSHOT (finding 2) |
| CON01 | CONSULTANT | PASS_EXACT | -0.5 | daily rate x worked days incl. weekly off, plus OT; residual is sheet rounding |
| CON05 | CONSULTANT | PASS_U2 | -0.03 | monthly consultant, sheet divides by 31; raw delta = 31/30 effect; delta shown after alignment (extension of U2 to consultants) |
| CON09 | CONSULTANT | PASS_U2 | 0.32 | monthly consultant, sheet divides by 31; raw delta = 31/30 effect; delta shown after alignment (extension of U2 to consultants) |
| CON12 | CONSULTANT | PASS_U2 | 0 | monthly consultant, sheet divides by 31; raw delta = 31/30 effect; delta shown after alignment (extension of U2 to consultants) |
| CON13 | CONSULTANT | PASS_U2 | 0 | monthly consultant, sheet divides by 31; raw delta = 31/30 effect; delta shown after alignment (extension of U2 to consultants) |
| CON20 | CONSULTANT | PASS_EXACT | -0.25 | daily rate x worked days incl. weekly off, plus OT; residual is sheet rounding |
| CON24 | CONSULTANT | PASS_EXACT | -0.5 | daily rate x worked days incl. weekly off, plus OT; residual is sheet rounding |
| BUNG01 | PUNE_STAFF | PASS_EXACT | 0 | no inputs needed |
| BUNG02 | PUNE_STAFF | PASS_EXCEPTION | 0 with HR entry (large as-is) | passes (delta 0) only if HR enters an approved negative adjustment AND the owner reading holds (the amount is a deduction); as-is the engine overpays by the same amount (finding 9) |
| BUNG06 | PUNE_STAFF | PASS_EXCEPTION | 0 with HR entry (large as-is) | passes (delta 0) only with an HR-entered approved negative adjustment; as-is the engine overpays by that amount |
| BUNG09 | PUNE_STAFF | PASS_EXACT | 0 | advance recovery comes from the live approved advance; the September sheet already has it. Must NOT be finalized for September (finding 5) |
| BUNG25 | PUNE_STAFF | PASS_EXACT | 0.33 | part-month proration rounding |
| BUNG30 | PUNE_STAFF | PASS_EXCEPTION | +33.66 only if OT hours written (large as-is) | sheet pays flat per-hour OT entered as Other Allowance; engine OT is gross/30/8 x hours. As-is large negative; with OT hours written to overtime_hours delta +33.66 (inside tolerance) but no screen writes BUNG OT hours |
| BUNG33 | PUNE_STAFF | PASS_EXCEPTION | above tolerance either way | flat per-hour OT; engine OT differs by more than tolerance even with OT hours written (documented sheet deviation) |
| CON16 | CONSULTANT (inactive) | NOT IN RUN | n/a | is_active=false: not assembled into any run, not held; not in the September sheet. If reactivated with attendance it calculates (daily rate, not held) |
| CON18 | CONSULTANT (inactive) | NOT IN RUN | n/a | is_active=false: not assembled into any run, not held; not in the September sheet. If reactivated with attendance it calculates (daily rate, not held) |
| CON21 | CONSULTANT (inactive) | NOT IN RUN | n/a | is_active=false: not assembled into any run, not held; not in the September sheet. If reactivated with attendance it calculates (daily rate, not held) |
| CON22 | CONSULTANT (inactive) | NOT IN RUN | n/a | is_active=false: not assembled into any run, not held; not in the September sheet. If reactivated with attendance it calculates (daily rate, not held) |
| CON23 | CONSULTANT (inactive) | NOT IN RUN | n/a | is_active=false: not assembled into any run, not held; not in the September sheet. If reactivated with attendance it calculates (daily rate, not held) |

## (d) Findings

### 1. pickSalary ignores is_active and effective_to (defect), data fix applied 27 Oct

- Defect: `pickSalary()` in `lib/payroll/feedSync.ts` picks the row with the latest `effective_from <= period end`. It does not look at `is_active` or any end date. A superseded (inactive) row with a later `effective_from` therefore beats the correct active row.
- Cause in the data: for the 6 disputed staff the old, inactive master rows were dated 2026-09-24, later than the correct active rows dated 2026-09-01, so the engine picked the stale masters.
- Data fix (27 Oct, by the lead on owner instruction): the old rows' `effective_from` was set to 2026-04-01. No code change.
- Before/after evidence (same inputs, same runner):
  - Before fix, all rows, September as-of: 64 staff PASS_U2 and 5 FAIL (the stale-master staff among the 6; the sixth, VFL5464, already picked a usable row), 1 exception, 1 OPEN. After fix: 69 PASS_U2, 0 FAIL.
  - Before fix with an active-only filter (what the proposed code change does): 69 PASS_U2, 0 FAIL. This proves the code defect and the data defect have the same effect, and that filtering on `is_active` alone fixes it.
- As-of checks on the fixed data: October as-of resolves every master (staff 64 exact, 5 within tolerance, 1 exception, 1 OPEN; workers 19 exact; this simulation is fed the September day counts, so it only shows masters resolve). August as-of finds no master for 84 people (held MISSING_MASTERS), because most masters are effective from 2026-09-24 or later; of the 6 people with an April-dated row, VFL1389 picks its old inactive April row and fails, a second demonstration of the defect. A back-dated August re-run is therefore not meaningful on the current masters.
- Proposed minimal code change (NOT applied): in `pickSalary()` add `r.is_active !== false` to the filter and, if the row carries an `effective_to`, require `effective_to` to be null or on/after the as-of date. SalaryRow would gain an optional `effective_to?: string | null`. Re-vendor into `supabase/functions/payroll-run/lib/` afterwards (source is `lib/payroll/`).

### 2. Worker OT passes ONLY with workerOtVdaBasis = 'MASTER_SNAPSHOT'; payroll-run does not set it

- All 19 workers are exact (inside 2 rupees) only with `workerOtVdaBasis: 'MASTER_SNAPSHOT'` and `workerMasterVdaSnapshot` set to the flat VDA master. With the default `CURRENT_RATE` basis all 19 are short, by amounts that range from inside the tolerance to well above it (the larger ones are above 100).
- `supabase/functions/payroll-run/index.ts` overrides only `workerVdaRatePerDay` (lines about 336 and 446). It never sets the basis or the snapshot. A real October run would therefore use `CURRENT_RATE` and underpay worker OT.
- Not changed in this work. To make October match the owner decision, `payroll-run` must set `workerOtVdaBasis` and `workerMasterVdaSnapshot` (or the engine default must change, which the regression suite also encodes). Decision needed (section X).

### 3. Staff U2: expectation for October is UNVERIFIED

- All 69 staff differ on raw days only because the sheet divides by 31 in a 30-day month; the engine uses 30. The raw delta is the 31/30 effect on gross, and on OT.
- October has 31 days, so the gap should vanish. This is UNVERIFIED. The October as-of simulation above reuses the September day counts and so only shows that masters resolve; it does not prove an October run will match any sheet.

### 4. What the app cannot pay in October for BUNG

- A positive manual allowance: there is no positive earnings input (`feedSync` only warns on approved positive adjustments).
- Flat per-hour OT as the sheet pays it: engine OT is gross/30/8 x hours.
- Any BUNG OT at all, unless `attendance_records.overtime_hours` is written; no screen lets the Pune attendance clerk or HR write OT hours for BUNG.
- Money entered by the Pune attendance clerk: the clerk screen records attendance only, so deductions or advances must be entered by HR as approved payroll adjustments.
- A monthly consultant with OT is held with CONSULTANT_OT.

### 5. BUNG09 September must NOT be finalized in the app

The September sheet already contains the advance recovery. Finalizing a September run in the app would run the advance recovery again and decrement the outstanding balance a second time (double recovery). September stays record-only.

### 6. CON16, CON18, CON21, CON22, CON23

All five are `is_active=false`. They are not assembled into any run (not held, simply absent) and are not in the September sheet. If reactivated with attendance they calculate on the daily rate.

### 7. VFL1520

`on_leave`: zero days, zero net, eligible-not-held. Not in the September sheet.

### 8. VFL1567 is OPEN

The sheet net exceeds the engine by a recurring positive "Other Allowance" with no earnings line and no engine input. The delta is large and equals the unexplained manual amount; the master matches the sheet. This is the only OPEN item.

### 9. BUNG02 ambiguity

The CSV literally shows the amount under Other Allowance (and the payable equals that amount because Gross Earnings is blank). The owner says it is a deduction. The pass depends on the owner reading: if it is a deduction, the engine passes after HR enters an approved negative adjustment (delta 0); if the CSV reading were right, the engine could not pay it (no positive allowance input).

## (e) Verdict

September gate: NOT YET PASSED - 1 OPEN (VFL1567) and pre-October blockers listed in section X

## X. Open decisions / required before October

1. VFL1567: what is the recurring positive Other Allowance, and will the owner add a positive earnings adjustment input (or classify it as a documented exception)? Until then the gate has 1 OPEN.
2. Worker OT: change `payroll-run` to set `workerOtVdaBasis` and `workerMasterVdaSnapshot` (or change the engine default), otherwise October worker OT is underpaid (finding 2). Needs an edit, redeploy of `payroll-run`, and a re-run of this report.
3. Apply the `pickSalary` fix (is_active, effective_to) and re-vendor, or accept the data fix alone (finding 1).
4. Confirm that extending U2 (31-day basis) to monthly consultants is accepted.
5. Confirm the BUNG02 reading (deduction, per the owner) so the pass is recorded against the right interpretation.
6. Decide how BUNG money items reach the engine for October: HR enters approved negative adjustments; a positive allowance input and BUNG OT hours entry do not exist.
7. Keep September record-only for BUNG09 (finding 5); do not finalize a September run.
8. Confirm consultants CON16, CON18, CON21, CON22, CON23 stay inactive (finding 6).
9. Confirm VFL1520 status (on leave) and that zero pay is intended.
10. HR must enter the October VDA per-day rate before the October run (existing blocker).
11. Verify the October staff expectation (finding 3) on the first real October run before finalizing.
