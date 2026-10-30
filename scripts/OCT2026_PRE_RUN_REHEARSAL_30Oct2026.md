# October 2026 pre-run rehearsal (read-only) - 30 Oct 2026

Pay period 1-31 Oct 2026. Run on live data as of 30 Oct (attendance to 30 Oct; 31 Oct not yet in).
SELECT-only against the live DB; `payroll-run` was NOT called; no pay run, period, adjustment or feed was written.
Only emp_codes, counts and verdicts below (no names, amounts, or bank/PAN/UAN values).

## Verdict table

| # | Check | Verdict | Result |
|---|---|---|---|
| A1 | October VDA per-day rate row | PASS | 1 row, rate > 0 |
| A2 | No October pay period / run yet | PASS | 0 periods, 0 runs (latest period = Sep; 24 runs, all archived) |
| A3 | BUNG: 7 active, structure in force on 31 Oct | PASS | 7/7; BUNG30 ot_rate=100, BUNG33 ot_rate=70 |
| A4 | Recurring adjustments active | PASS | 1 row: VFL1567 earning from 1 Oct |
| A5 | Active employees lacking a structure valid on 31 Oct | PASS | 0 of 106 (VFL5464 now has a master, effective 26 Jul; the older "master missing" note is stale) |
| A6 | BUNG09 advance | PASS | approved, outstanding = 6000, monthly = 2000 |
| A7 | Inactive-by-decision stay inactive | PASS | CON16/18/21/22/23 inactive; VFL1520 active with `on_leave` from 1 Sep and no `left` row |
| Pop | Populations, no overlap | PASS | PUNE_STAFF 7, CONSULTANT 7, PERMANENT_WORKER 19, STAFF 73 = 106 active; each employee in exactly one |
| Fd | Feeds for October | ATTENTION | canteen 0, society 0, efficiency 0, adjustments 0 (expected: not yet entered) |
| Adv | Advances / leave / half-day C-off | ATTENTION | pending advances: VFL1556, VFL5324; pending leave: 5 requests (VFL1389 x3, VFL1562, VFL5433); half-day C-off pending decisions: 0 |
| Att-P | BUNG attendance for October | BLOCKER | 0 rows ever for any BUNG employee (no Pune clerk entry yet) |
| Att-A | Aurangabad attendance 1-30 Oct | PASS | rows on every day; every Friday carries WO rows; 30 Oct = WO only (31 Oct not yet in) |
| Hol | 20 Oct | ATTENTION | only 2 present all-company (looks like a holiday); `public_holidays` is empty, so the engine counts it unpaid unless approved leave/PH is entered |
| Eng | Offline engine rehearsal | BLOCKER | 4 monthly consultants would be HELD (CONSULTANT_OT); see below |
| Arr | Arrears prerequisites | PASS | see below |

## Per-population detail

Head count / no structure / no bank details (bank is info only, never a blocker):

| Population | Active | No structure valid 31 Oct | No bank details (codes) |
|---|---|---|---|
| PUNE_STAFF | 7 | 0 | 0 |
| CONSULTANT | 7 | 0 | 2: CON01, CON20 |
| PERMANENT_WORKER | 19 | 0 | 0 |
| STAFF | 73 | 0 | 11: VFL1557, VFL1560, VFL1567, VFL5272, VFL5397, VFL5400, VFL5405, VFL5446, VFL5458, VFL5465, VFL5466 |

Cron jobs active: apply-due-exits, auto-checkout, five-s-challenge-generator, forms-due-reminder, halfday-coff-auto-escalate, mark-weekly-offs, mrm-reminder, mrm-reminder-escalation, nightly-scoring, plant-head-form-reminder, pune-attendance-reminder, shift-reminder-default (command column not read).

## Attendance readiness (1-30 Oct, active employees)

| Population | Rows | Late rows (status L) | late_minutes > 30 (rows / people) | No-checkout rows | OT-hours rows | Travel rows |
|---|---|---|---|---|---|---|
| STAFF | 1742 | 167 | 135 / 49 | 14 | 0 (clerk col) | 0 |
| PERMANENT_WORKER | 424 | 58 | 54 / 14 | 3 | 0 | 0 |
| CONSULTANT | 166 | 18 | 15 / 4 | 0 | 0 | 0 |
| PUNE_STAFF | 0 | - | - | - | 0 | 0 |

- `ot_hours` / `outstation_travel` columns exist, but are unused so far (no BUNG entry yet).
- Punched-absent (check-in on an `A` row): 0.
- Estimated `late_excess` warnings at pre-check (late_minutes > 30, all employees, to 30 Oct): 204 flagged dates across 67 people; 17 people reach the 4th flagged late (deduction-eligible), 72 deductible dates in total, max 16 for one person. Each needs a HR decision (waive/deduct) and an AI review before calculate. Absent-day and efficiency warnings are in addition (see Eng).
- Employees with zero present days all month: BUNG01/02/06/09/25/30/33 (no rows), CON24, VFL1520 (on leave), VFL1557, VFL4072, VFL5439, VFL5457 (WO rows only). The engine still pays weekly offs: VFL1557, VFL5439, VFL5457 and CON24 calculate to a positive net with 0 days present; VFL4072 calculates to 0.
- No-checkout rows: 17 (staff 14, worker 3) - handled by the existing default-hours convention, informational.

## Offline engine rehearsal (structural only)

Method: a Node script in the scratchpad (not in the repo) loaded live inputs by SELECT (salary structures, attendance, approved advances, the recurring allowance, status events; no approved leave, canteen, society, efficiency or adjustments exist yet) and ran the vendored, deployed `payroll-run` modules (`assemblePayrollInputs`, `buildEngineConfig`, `calculateWithExtras`, `filterByPopulation`) per population with VDA 103/day. Attendance is to 30 Oct and no 31 Oct, so this is structural only; no pay figures are recorded here.

| Population | Inputs | Calculated | Held | Thrown |
|---|---|---|---|---|
| PUNE_STAFF | 7 | 6 | BUNG09: NET_NEGATIVE | 0 |
| STAFF | 73 | 71 | VFL1001: MISSING_MASTERS; VFL1520: NET_NEGATIVE | 0 |
| PERMANENT_WORKER | 19 | 19 | none | 0 |
| CONSULTANT | 7 | 3 | CON05, CON09, CON12, CON13: CONSULTANT_OT | 0 |

Findings:
- **CONSULTANT_OT (BLOCKER):** monthly consultants are held by the engine whenever `attendance_records.overtime_hours` > 0 (engine `calcSimple`). The app auto-fills `overtime_hours` on check-out, and CON05/09/12/13 all have OT-hours rows in October. The 27 Oct owner decision "monthly consultants: no OT (engine behaviour stands)" is therefore NOT what happens: the engine does not ignore their OT, it holds the whole employee. Unless fixed, October pays only CON01, CON20, CON24 (daily-rate) from the consultant run. Needs a decision on the fix (zero consultant OT in feedSync, or accept the hold), then a Sonnet agent edit + re-vendor + redeploy before the CONSULTANT run.
- **BUNG09 / all BUNG:** NET_NEGATIVE / zero pay purely because Kajal has entered nothing; BUNG09's 2000 advance recovery turns net negative. Resolves once attendance is entered.
- **VFL1520 (NET_NEGATIVE):** on leave with zero days but an approved advance (monthly 4000) with nothing to deduct from; the engine holds him and writes no item, so he gets no slip. Owner to decide what happens to his September-onward leave pay and advance recovery.
- **VFL1001 (MISSING_MASTERS):** owner's structure is all zero, held. Expected (unchanged from earlier note); confirm it stays held.
- Warnings assembled: 89 feed-level warnings, mostly "N late day(s) counted as present - apply late-deduction policy separately" (informational) plus 19 x "no approved efficiency % for 2026-10 - production allowance 0" (all 19 workers, until the plant head enters efficiency).
- The worker OT basis is MASTER_SNAPSHOT (flat VDA master) in the PERMANENT_WORKER run; the other three runs print a harmless `WORKER_VDA_MASTER_MISSING` config warning (no workers in them).
- Working days: STAFF/PUNE/CONSULTANT 31, PERMANENT_WORKER 26.
- Staff/worker OT from app-computed `overtime_hours`: 62 staff (565.1 h), 14 workers (163.8 h) would receive OT pay. Not previously discussed for staff; one record shows a single day with 12 OT hours (VFL1453, 14 Oct) - suggest HR eyeball outliers before calculate.

## Arrears (attach_arrears_sep26_30) - prerequisites only, not executed

- 101 archived September items exist: PUNE_STAFF 4, CONSULTANT 7, PERMANENT_WORKER 19, STAFF 71. All 101 employees are still active; 0 already carry `arrears_sep26_30`; `advance_recoveries` has 0 rows.
- Active employees WITHOUT a September item (arrears will skip them, no 26-30 Sep bridge): BUNG01, BUNG06, BUNG25, VFL1001, VFL1520.
- One PUNE_STAFF September item has a non-positive net (arrears 0 or negative for that person); check before attaching.
- The action is per run and uses only that run's items, so with four population runs each employee is attached once. It is not idempotent: do not press it twice on the same run, and calculate wipes it (attach only after the final calculate).
- Helper runs only on `calculated`/`in_review` October runs and is refused for top-up runs.

## What HR / owner must do before the real run (in order)

1. **Decide and fix the monthly-consultant OT hold** (CON05, CON09, CON12, CON13): either ignore consultant OT in feedSync (then Claude edits via Sonnet agent, re-vendors, redeploys `payroll-run` v10) or have the hold accepted. Without it the CONSULTANT run pays only 3 of 7.
2. **Kajal enters all October BUNG attendance** (More -> Pune Attendance: status per day, `ot_hours` next day, outstation travel) for 1-31 Oct; none exists today. Without it all seven BUNG calculate to zero and BUNG09 is held.
3. **HR enters BUNG02 / BUNG06 deductions** as approved negative adjustments before calculating the PUNE_STAFF run (otherwise they slip to an adjustment/top-up).
4. **Decide 20 Oct** (almost no attendance company-wide; `public_holidays` is empty): paid holiday (HR enters PH/approved leave or an adjustment) or unpaid.
5. **Clear pending approvals**: leave VFL1389 (EL x3: 29 Sep, 26 Oct, 28 Oct), VFL1562 (SL 21-22 Oct), VFL5433 (CL 1-3 Oct); advances VFL1556 and VFL5324 (fix the "10000 months" typo). Half-day C-off decisions: none pending now.
6. **Plant head enters efficiency %** (needed for all 19 workers' production allowance; else 0 and flagged), and HR enters canteen / society / one-off adjustments before calculate.
7. **Wait for 31 Oct attendance** (Saturday) to be complete, then create the four October runs (period 1-31 Oct), run `generate_warnings`: ~204 late-over-30 dates across 67 people need decisions (waive/deduct) and the AI review; 4th-and-later lates deduct (17 people eligible).
8. **Decide VFL1520** (on bereavement leave, advance outstanding): the engine holds him (NET_NEGATIVE) so he gets no October item; owner to decide the leave pay and whether to recover the advance.
9. **Confirm the zero-attendance people**: VFL1557, VFL5439, VFL5457, CON24 (weekly offs only, still calculate to a positive net) and VFL4072 (calculates to 0).
10. **Confirm VFL1001 stays held** (all-zero structure) and the three BUNG with no September item (BUNG01/06/25) get no arrears.
11. **Eyeball extreme overtime rows** (staff/worker OT is app-computed; e.g. VFL1453 12 h on 14 Oct, VFL4026 11.98 h on 22 Oct) and confirm staff OT is meant to be paid.
12. Bank details (13 codes above) stay a HR task due 3 Nov; blank bank cells never hold a run.
13. After calculate: attach arrears once per run, verify against `OCT2026_RUN_VERIFICATION.sql` sections B-D (checks B3/D3b/D3c now apply per population).

## Not run / limits

- Warnings-generation estimate is SQL-only (the `computeRunWarnings` module was not run); `no_punch` for Aurangabad and `missing_efficiency` counts were not simulated beyond what is above.
- Leave dates (approved leave) were not simulated: none is approved yet.
- Salaries/attendance were transcribed into the scratchpad script by hand from SELECT results; the engine run is structural (held/calculated counts), not a pay-figure check.
- Verification SQL sections B-E apply to a real run and could not be run.
