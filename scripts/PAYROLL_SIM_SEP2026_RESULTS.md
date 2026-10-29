# September 2026 payroll gate simulation (all four populations)

Run 26 Oct 2026. Offline, read-only. Runner: `scripts/payroll-sim-sep2026.ts` (reads a JSON data file given on argv; no data is in the repo). Extraction queries: `scripts/payroll-sim-sep2026.sql` (SELECT only).
This file holds employee codes and rupee deltas only. Per-person amounts are in the scratchpad detail file, not in the repo.

## Method

- Inputs built with the vendored `assemblePayrollInputs` (live `employee_salary_structure`, live `employees` flags: category, gender, `pt_exempt`, `weekly_off_day`; category routing by emp_code via `mapCategory`), then `calculateOne` with `DEFAULT_ENGINE_CONFIG` (CURRENT_RATE worker OT basis).
- Day counts, OT hours and feeds injected exactly as the September sheet (synthetic attendance rows and feed rows), because live app attendance only exists from ~24 Sep and the September feed tables are empty. Worker/Consultant/Pune counts come from the Drive tabs; Staff counts come from the archived September run (`pay_runs.status='archived'`, month `09`, year `2026`).
- Sheet reference net = archived September `pay_run_items.net_pay`; for Pune see the Pune section (the sheet tab is incomplete).
- Efficiency feed for workers: 81 % for all (proved per worker below). No production-offset deduction is fed, because the sheet's offset is exactly the difference between its displayed full slab and the 81 % slab prorated by present days.
- U2 proof: second run with days and OT hours scaled by `wd/31` (the sheet divides by 31 in a 30-day month). A person who fails the raw run but clears 2 rupees when scaled is "U2".
- Pass bar as written: net within 2 rupees, or explained by a documented FROZEN rule (U2, U5). Classes beyond that (U1R, VDAOT, U6, EXTRA) have a proven or documented cause but are NOT frozen rules, so they are listed separately and still fail the strict bar.

## Summary

| population | in sheet | calculated | held | exact (<=2) | U2 | U5 | U1R | VDAOT | U6 | EXTRA | no documented cause |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| STAFF | 71 | 70 | 1 | 0 | 58 | 0 | 5 | 0 | 5 | 2 | 0 |
| PERMANENT_WORKER | 19 | 19 | 0 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | 0 |
| CONSULTANT | 7 | 7 | 0 | 3 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| PUNE_STAFF | 7 (4 in archive) | 7 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 3 | 0 |

Class key. EXACT: within 2 rupees on raw sheet days. U2: frozen 31-day basis, proven by scaling. U5: frozen production-allowance proration (no worker needed it, see Workers). U1R: rounding of the owner-decided `FIXED_GROSS = basic/0.40` rule, residual at most 3.5. VDAOT: worker OT priced on the CURRENT VDA basis (owner decision 20 Oct 2026). U6: live salary master differs from the sheet (HR data). EXTRA: the sheet pays an amount that is not in any earnings line and the engine has no input for it.

## STAFF (71 in sheet, 70 calculated, 1 held)

Raw sheet days: 0 of 70 are within 2 rupees, because every staff row in the sheet is on the 31-day basis (U2). Judged on the raw bar, all 70 fail until U2 is applied; the table below is the proof that U2 is the only reason for 58 of them.

**Explained by frozen rule U2 (58).** Scaled delta (rupees) in brackets, all within 2:
VFL1064 (0), VFL1066 (+0.49), VFL1272 (-0.72), VFL1290 (+0.2), VFL1327 (-0.97), VFL1391 (-0.35), VFL1450 (+0.4), VFL1453 (+1.67), VFL1482 (+0.07), VFL1516 (-0.19), VFL1528 (0), VFL1543 (-0.8), VFL1545 (0), VFL1549 (-0.28), VFL1557 (0), VFL1560 (0), VFL1562 (-0.92), VFL1564 (-0.08), VFL4057 (-0.44), VFL5079 (0), VFL5237 (+0.68), VFL5272 (+0.46), VFL5273 (+0.53), VFL5302 (-0.13), VFL5303 (+1.15), VFL5318 (+1.75), VFL5321 (-0.16), VFL5324 (-0.19), VFL5347 (-1.97), VFL5379 (-0.8), VFL5382 (-0.22), VFL5397 (-1.35), VFL5399 (+0.28), VFL5400 (-0.32), VFL5405 (-0.54), VFL5409 (-1.79), VFL5413 (-0.22), VFL5430 (+0.04), VFL5434 (+0.49), VFL5439 (-1.03), VFL5440 (-0.01), VFL5444 (-1.33), VFL5446 (-1.56), VFL5447 (-0.93), VFL5448 (+1.65), VFL5449 (+1.89), VFL5450 (-1.8), VFL5451 (-1.7), VFL5452 (-1.72), VFL5454 (-0.99), VFL5457 (+0.34), VFL5458 (+1.5), VFL5460 (-0.68), VFL5461 (-2), VFL5462 (+0.56), VFL5463 (+0.44), VFL5465 (-1.11), VFL5466 (-0.79).
Raw deltas for these are all positive (the engine pays 31/30 of a 30-day month; OT is also priced on 30 days instead of 31).

**Documented decision, rounding only: U1R (5), scaled delta 2.05 to 3.48.** Not frozen rules, but proven rounding:
VFL1386 (-3), VFL1446 (-2.18), VFL1527 (-2.61), VFL5433 (+2.05), VFL5459 (-3.48).
Proof: the engine derives FIXED_GROSS as basic/0.40 (U1, owner decision 20 Oct), which loses up to 0.5 rupee of the sheet's integer gross, then pays the sum of nine integer-rounded components; the sheet pays its unrounded gross, rounds ESI to whole rupees and the net to whole rupees. Substituting the sheet-consistent integer master gross, the sheet's unrounded gross for the component sum, and the sheet's whole-rupee ESI brings every one of the five to within 0.45 rupee (VFL1386 0, VFL1446 -0.18, VFL1527 -0.06, VFL5433 +0.31, VFL5459 -0.45). The 20 Oct staff run recorded the same three-rupee band for VFL1386/5347/5459.

**U6, live salary master differs from the sheet (5), HR data, open since 20 Oct:**
| code | raw delta | scaled delta | proof |
|---|---:|---:|---|
| VFL1389 | negative | negative | live master below sheet; clears with sheet-implied master |
| VFL1556 | negative | negative | live master below sheet; clears with sheet-implied master |
| VFL1566 | negative | negative | live master below sheet; clears with sheet-implied master |
| VFL5322 | negative | negative | live master below sheet; clears with sheet-implied master |
| VFL5442 | negative | negative | live master below sheet; clears with sheet-implied master |

**EXTRA: sheet pays an amount outside its own earnings lines (2), not explained by any frozen rule:**
| code | raw delta | scaled delta | evidence |
|---|---:|---:|---|
| VFL1463 | large negative | large negative | the sheet net exceeds (its own earnings + OT - its own deductions) by an unexplained manual amount (see scratchpad detail); master gross matches the sheet exactly |
| VFL1567 | negative | negative | sheet net exceeds its own components by an unexplained manual amount (see scratchpad detail); master matches the sheet |
Root cause: the sheet adds a positive amount (arrears / allowance / incentive style) that has no line in the snapshot. The engine has no earnings-adjustment input; `feedSync` only warns on approved positive adjustments ("not applied"). The source of these amounts is not in the archive; HR must say what they are.

**Held (1):** VFL5464, `MISSING_MASTERS`: no `employee_salary_structure` row (the documented U7 item). The sheet paid this person (staff, sheet net exists), so the hold is an unexpected hold for a real run until HR supplies the master.

## PERMANENT_WORKER (19 in sheet, 19 calculated, 0 held)

- Production allowance (U5): no worker needed U5. For all 19, the sheet's displayed full slab minus its production offset equals the 81 % slab prorated by present days (rounded) to within 1 rupee, so the sheet is the 81 % slab prorated by present days, exactly the engine's rule. The "full-slab manual exception" for VFL4024 and VFL4033 does not exist in the figures: both are consistent with the prorated slab (the displayed full slab is offset back to the prorated amount).
- All 19 fail the raw bar by 3.34 to 112.35 rupees, all negative (engine pays less). Cause: worker OT is priced on the CURRENT VDA basis (rate x working days), as decided 20 Oct 2026 and recorded in the engine header and regression suite; the legacy sheet uses the frozen master VDA snapshot. Proof: re-running each of the 19 with `MASTER_SNAPSHOT` clears every one to within 2 rupees. The shortfall is proportional to OT hours.
- Deltas (rupees): VFL4008 -76.41, VFL4011 -101.22, VFL4012 -50.41, VFL4024 -82.05, VFL4025 -89.32, VFL4026 -112.35, VFL4032 -7.53, VFL4033 -42.71, VFL4036 -98.5, VFL4041 -97.69, VFL4042 -110.77, VFL4043 -26.64, VFL4045 -98.97, VFL4063 -103, VFL4065 -96.22, VFL4066 -8.72, VFL4068 -89.72, VFL4071 -4.09, VFL4072 -3.34.
- VFL4063 (PT-exempt flag set live) gets PT 0 as in the sheet.
- Not a frozen rule in the owner's list, so these 19 are reported as VDAOT and fail the strict bar. If the owner confirms the 20 Oct CURRENT_RATE decision covers this, they are explained.

## CONSULTANT (7 in sheet, 7 calculated, 0 held)

- EXACT (3): CON01 (-0.5), CON20 (-0.25), CON24 (-0.5). Daily-rate consultants, rate x days plus OT x 1; the 0.5 rupee residual is the sheet rounding OT to whole rupees. CON24 is now daily (PATCH_97) and no longer hits CONSULTANT_OT.
- U2 (4): CON05 (raw +462.33, scaled -0.03), CON09 (+643.33, +0.32), CON12 (raw delta = 31/30 of monthly rate; clears when scaled), CON13 (same; clears when scaled). These are monthly-gross consultants; the Consultant tab header itself shows 31 total working days for September, and CON12 and CON13 show 31 worked days in a 30-day month. U2 is documented for staff; applying it to monthly-rate consultants is an extension that the owner should confirm. In a real run the app cannot count more than 30 paid days, which gives the sheet's figure.

## PUNE_STAFF incl. BUNG (7 rows in the Pune SEPT tab, 4 in the archive, 7 calculated, 0 held)

All 7 BUNG have monthly masters that equal the sheet's "Gross As Per Masters" (loaded 25 Oct). Findings on the sheet itself:
- The SEPT tab has the "Gross Earnings" column blank for every row. The tab's payable figure is therefore only (other allowance minus deductions): BUNG01, BUNG06 and BUNG25 show payable 0, and BUNG02, BUNG09, BUNG30, BUNG33 show only their allowance or deduction. The archive imported only the 4 non-zero rows (BUNG02, BUNG09, BUNG30, BUNG33) and mirrors the tab exactly (no import difference).
- So the Sept tab cannot serve as a net to certify against. The comparison used is the Pune July-tab formula applied to September counts: `round(gross x worked / working days) - deductions + other allowance` (checked against the July-tab rows read: a full month, a month with a weekly off, and a part-month row, all reproduced). This reconstruction is inferred, not read from a formula cell (the formula read was rejected by the Sheets tool).
- Against that reconstruction: EXACT (4): BUNG01 (0), BUNG06 (0, with its other deduction fed), BUNG09 (0, with its advance fed), BUNG25 (+0.33).
- EXTRA (3): BUNG02 (delta equals sheet manual allowance), BUNG30 (-799.67), BUNG33 (-629.67). Each equals the sheet's positive "Other Allowance" (two of them labelled with an "OT=" note). The OT hours / OT amount columns are blank in the tab, so these are manual allowances, not formula OT (formula OT would give different amounts). The engine has no positive-allowance input. BUNG02's note text disagrees with its allowance cell: needs HR to confirm.
- Whether the Pune people were actually paid base salary for September is not answerable from the tab.

## Coverage

- In app (active) but not in the September sheet or archive: **VFL1001** (owner; all-zero structure, `MISSING_MASTERS`, expected: not paid through payroll), **VFL1520** (staff, has a master, not in the September sheet or archive; needs HR decision: has this person left, or been omitted?).
- In the September sheet but not active in the app: none.
- Pune: the 3 BUNG not in the archive (BUNG01, BUNG06, BUNG25) are in the Pune tab with payable 0.
- Staff Drive tab was not read (not requested); Staff import fidelity rests on the archive only.

## Import fidelity (archive vs Drive tabs)

- Worker "Sep 2026" tab, all 19: present, EL/CL/SL/PH, worked days, OT hours, canteen, society, production offset, payable all equal the archive; VDA / 103 equals present days. No differences.
- Consultant "Sept 2026" tab, all 7: worked days, OT hours, payable equal the archive. No differences.
- Pune "SEPT" tab, 7 rows: the 4 archived rows match (worked days, payable); 3 rows have payable 0 and were not imported.

## Verdict

**FAIL.**
- Unexpected holds: VFL5464 (MISSING_MASTERS; sheet paid this person).
- Not within 2 rupees and not explained by a frozen rule (U2/U5), 34 people: 19 workers (VDAOT), 5 staff (U1R rounding, at most 3.5), 5 staff (U6 master data), 2 staff (EXTRA: VFL1463, VFL1567) and 3 Pune (EXTRA: BUNG02, BUNG30, BUNG33). Every one of the 34 has a proven root cause above; none is an unexplained mystery. Nothing is a frozen-rule case other than the 58 + 4 U2 people.
- What it would take to turn this into a PASS: owner confirmation that the 20 Oct CURRENT_RATE OT decision and the U1 rounding band are accepted differences; HR corrects the 5 U6 masters and supplies the VFL5464 master; and a decision on how the sheet's positive manual amounts (VFL1463, VFL1567, BUNG02/30/33) enter payroll (an earnings-adjustment input does not exist).

## Gates run

- `npx tsx scripts/payroll-engine.sept2026.test.ts`: 58 passed, 0 failed.
- `npx tsx scripts/payroll-feedsync.test.ts`: 42 passed, 0 failed.
- `npx tsc --noEmit`: 7 errors (baseline), none in the new files.
