# Re-run after U1/U3/U4 fixes (20 Oct 2026)

> **INTERNAL: individual salary figures. HR / owner only.** Offline and read-only, same method as the original run below (assemblePayrollInputs then calculateOne, DEFAULT_ENGINE_CONFIG, vendored feedSync). No DB writes, no HTTP calls, no deploy.

## Fixes made (`lib/payroll/feedSync.ts`, re-vendored byte-for-byte to `supabase/functions/payroll-run/lib/feedSync.ts`)

- **U1 done.** `mastersFrom(s, cat)`: STAFF `FIXED_GROSS = basic / 0.40` (null/0 basic leaves it undefined, so the employee is held as before; never falls back to `ctc_annual`). `mastersFrom` is called only for STAFF and PERMANENT_WORKER masters, so workers keep `ctc_annual / 12` unchanged (the engine reads `FIXED_GROSS` only on the staff path). The second place, `monthlyGross: sal?.ctc_annual / 12` (line ~225), feeds the **CONSULTANT / PUNE_STAFF** rate profile, not staff, and is left untouched.
- **U3 done.** Gender is trimmed and lower-cased; `female` or `f` gives `'F'`, everything else `'M'`.
- **U4 NOT done (stopped, no schema added).** `PayrollInput.ptExempt` exists (types.ts, engine.ts reads it), but no column in the live DB holds a PT-exempt flag (checked every public column for exempt / pt / tax names: only `pt_slabs.pt_amount`). `employees` and `employee_salary_structure` have none. The runner select (`employees` with an explicit column list; `employee_salary_structure` with `*`) would need the column once a source exists. Needs an owner decision on the data source for the exempt list (VFL4021, VFL4014, VFL4063).
- U2 (31 vs 30 day pay basis) and U5 (production-allowance proration) stay as frozen engine rules per owner decision. VFL4024 / VFL4033 full Rs 8,500 production allowance are documented manual sheet exceptions.

## Tests

- `scripts/payroll-engine.sept2026.test.ts`: 58 passed, 0 failed.
- `scripts/payroll-feedsync.test.ts`: 16 passed, 0 failed.

## New summary (live app attendance, normal path)

- Engine inputs 99; calculated **86** (was 82); held **13** (was 17). The 5 new hires VFL5458, 5459, 5460, 5461, 5462 are no longer held. Newly held: VFL1389 (NET_NEGATIVE: master Basic 10,500 gives fixed gross 26,250 vs sheet 29,000, a U6 data issue). Other holds: 7 consultants (MISSING_RATE), VFL1001 and VFL5464 (MISSING_MASTERS), VFL1520, VFL1567, VFL5079 (NET_NEGATIVE, short app attendance).
- Comparable with archive: 86 employees. Gap is still dominated by short app attendance (from ~24 Sep), no app OT, no efficiency feed, as described in the original run.

## Diagnostic re-run: STAFF vs sheet (archived paid days / OT injected), tolerance Rs 2

Two injections, because of U2 (the sheet pays on 31 days, the engine on calendar days):

| Staff (69 with archive, 1 held) | gross | Basic | PF | ESI | PT | all five |
|---|---:|---:|---:|---:|---:|---:|
| Raw archived paid days (w=31 against engine wd=30) | 0 | 0 | 14 | 34 | 68 | 0 |
| Paid days scaled to engine basis (w x wd/31), isolates U2 | **60** | **63** | **65** | **65** | **68** | **60** |

(Engine gross here = totalEarnings minus OT, comparable to the sheet staff gross.) The raw column fails only because of the U2 31-day basis; with U2 removed, 60 of 68 calculable staff match on all five lines.

Remaining staff mismatches (scaled run):
- Rounding only (within Rs 3): VFL1386 gross 148,706 vs 148,703; VFL5347 17,405.16 vs 17,403; VFL5459 11,906.03 vs 11,903.
- U6 data (master differs from sheet): VFL1389 (gross 29,000 vs 26,251, Basic 11,600 vs 10,500), VFL1556 (19,720 vs 17,702), VFL1566 (45,000 vs 41,040), VFL5322 (18,637 vs 16,911), VFL5442 (18,036 vs 14,515); PF and ESI follow.
- VFL5464: no salary structure row (MISSING_MASTERS), sheet gross 29,032.

PT: women (gender female) get PT 0 where the sheet had 0 (VFL5440, VFL5446; VFL5464 held, sheet PT 200). VFL4063 is a **worker**: engine PT 200, sheet blank, because the exempt flag (U4) is still unwired. VFL4021 / VFL4014 are not in the Sept fixtures.

## Gap table (normal comparison, A = archived sheet, E = engine, live app attendance)

Note: staff archived gross excludes OT; engine gross includes OT. Compare Net.

| Code | Cat | Paid days A / E | Gross A / E | Basic A / E | PF A / E | ESI A / E | PT A / E | OT A / E | Net A / E | Net diff |
|---|---|---|---|---|---|---|---|---|---|---:|
| VFL1386 | STAFF | 31 / 6 | 148706 / 29740 | 59482 / 11896 | 1800 / 1800 | - / 0 | 200 / 200 | 0 / 0 | 136706 / 27740 | -108966 |
| VFL1463 | STAFF | 31 / 4 | 57750 / 7700 | 23100 / 3080 | 1800 / 535.92 | - / 0 | 200 / 175 | 0 / 0 | 95750 / 6989.08 | -88760.92 |
| VFL4026 | PERMANENT_WORKER | 26 / 0 | 59044 / 0 | 15756 / 0 | 1800 / 0 | - / - | 200 / 0 | 18724.33 / 0 | 52771 / 0 | -52771 |
| VFL1560 | STAFF | 31 / 4 | 62000 / 8267 | 24800 / 3307 | 1800 / 575.4 | - / 0 | 200 / 175 | 0 / 0 | 60000 / 7516.6 | -52483.4 |
| VFL4011 | PERMANENT_WORKER | 26 / 0 | 56992 / 0 | 15756 / 0 | 1800 / 0 | - / - | 200 / 0 | 16762.73 / 0 | 50546 / 0 | -50546 |
| VFL4025 | PERMANENT_WORKER | 26 / 1 | 55407 / 1228.03 | 15756 / 606 | 1800 / 85.08 | - / - | 200 / 0 | 14979.46 / 0 | 49307 / 1142.95 | -48164.05 |
| VFL4036 | PERMANENT_WORKER | 26 / 3 | 56633 / 3682.97 | 15756 / 1818 | 1800 / 255.24 | - / - | 200 / 0 | 16316.91 / 0 | 50460 / 3427.73 | -47032.27 |
| VFL4042 | PERMANENT_WORKER | 26 / 3 | 58348 / 3632.36 | 15756 / 1818 | 1800 / 255.24 | - / - | 200 / 0 | 18367.67 / 0 | 47560 / 3377.12 | -44182.88 |
| VFL4068 | PERMANENT_WORKER | 26 / 3 | 53737 / 3515.11 | 15756 / 1818 | 1800 / 255.24 | - / - | 200 / 0 | 14979.46 / 0 | 46746 / 3259.87 | -43486.13 |
| VFL1528 | STAFF | 31 / 6 | 55290 / 11056 | 22116 / 4423 | 1800 / 769.44 | - / 0 | 200 / 200 | 0 / 0 | 47895 / 5086.56 | -42808.44 |
| VFL4012 | PERMANENT_WORKER | 26 / 0 | 48547 / 0 | 15756 / 0 | 1800 / 0 | - / - | 200 / 0 | 8381.37 / 0 | 42274 / 0 | -42274 |
| VFL4063 | PERMANENT_WORKER | 26 / 6 | 55727 / 6995.53 | 15756 / 3636 | 1800 / 510.48 | - / - | - / 0 | 17119.38 / 0 | 46211 / 6485.05 | -39725.95 |
| VFL4041 | PERMANENT_WORKER | 26 / 4 | 56295 / 4888.24 | 15756 / 2424 | 1800 / 340.32 | - / - | 200 / 0 | 16227.75 / 0 | 44021 / 4547.92 | -39473.08 |
| VFL4045 | PERMANENT_WORKER | 26 / 4 | 56068 / 4812.22 | 15756 / 2424 | 1800 / 340.32 | - / - | 200 / 0 | 16495.24 / 0 | 43169 / 4471.9 | -38697.1 |
| VFL4065 | PERMANENT_WORKER | 26 / 4 | 54704 / 4686.8 | 15756 / 2424 | 1800 / 340.32 | - / - | 200 / 0 | 16049.42 / 0 | 41652 / 4346.48 | -37305.52 |
| VFL5439 | STAFF | 31 / 0 | 23048 / 0 | 9219 / - | 1604.16 / - | - / - | 200 / - | 15464.13 / 0 | 36708 / 0 | -36708 |
| VFL1566 | STAFF | 31 / 5 | 45000 / 6840 | 18000 / 2736 | 1800 / 475.92 | - / 0 | 200 / 0 | 0 / 0 | 42600 / 6364.08 | -36235.92 |
| VFL4008 | PERMANENT_WORKER | 26 / 5 | 52827 / 6109.39 | 15756 / 3030 | 1800 / 425.4 | - / - | 200 / 0 | 12661.21 / 0 | 41851 / 5683.99 | -36167.01 |
| VFL1391 | STAFF | 31 / 5 | 28000 / 4667 | 11200 / 1867 | 1800 / 324.84 | - / 0 | 200 / 0 | 14180.65 / 0 | 40181 / 4342.16 | -35838.84 |
| VFL5324 | STAFF | 31 / 6 | 26000 / 5200 | 10400 / 2080 | 1800 / 361.92 | - / 0 | 200 / 0 | 11825.81 / 0 | 35826 / 4838.08 | -30987.92 |
| VFL4024 | PERMANENT_WORKER | 21 / 4 | 48095 / 4909.68 | 12726 / 2424 | 1787 / 340.32 | - / - | 200 / 0 | 13820.34 / 0 | 34600 / 4569.36 | -30030.64 |
| VFL4032 | PERMANENT_WORKER | 26 / 5 | 41527 / 6111.3 | 15756 / 3030 | 1800 / 425.4 | - / - | 200 / 0 | 1248.29 / 0 | 35352 / 5685.9 | -29666.1 |
| VFL4066 | PERMANENT_WORKER | 26 / 4 | 40288 / 4686.8 | 15756 / 2424 | 1800 / 340.32 | - / - | 200 / 0 | 1426.62 / 0 | 33900 / 4346.48 | -29553.52 |
| VFL1446 | STAFF | 31 / 5 | 24936 / 4154 | 9974 / 1662 | 1735.44 / 289.08 | - / 0 | 200 / 0 | 9652.26 / 0 | 32653 / 3864.92 | -28788.08 |
| VFL5302 | STAFF | 31 / 4 | 27000 / 3600 | 10800 / 1440 | 1800 / 250.56 | - / 0 | 200 / 0 | 7533.87 / 0 | 32059 / 3349.44 | -28709.56 |
| VFL5458 | STAFF | 30 / 5 | 25161.29 / 4333 | 10065 / 1733 | 1751.4 / 301.56 | - / 0 | 200 / 0 | 8512.9 / 0 | 31723 / 4031.44 | -27691.56 |
| VFL4043 | PERMANENT_WORKER | 26 / 2 | 43822 / 2406.96 | 15756 / 1212 | 1800 / 170.16 | - / - | 200 / 0 | 4547.34 / 0 | 29894 / 2236.8 | -27657.2 |
| VFL4072 | PERMANENT_WORKER | 26 / 0 | 39485 / 0 | 15756 / 0 | 1800 / 0 | - / - | 200 / 0 | 624.14 / 0 | 26339 / 0 | -26339 |
| VFL4071 | PERMANENT_WORKER | 26 / 3 | 39663 / 3515.11 | 15756 / 1818 | 1800 / 255.24 | - / - | 200 / 0 | 802.47 / 0 | 29205 / 3259.87 | -25945.13 |
| VFL5318 | STAFF | 31 / 3 | 20262 / 2028 | 8105 / 811 | 1410.36 / 141.24 | 152 / 15.2 | 200 / 0 | 9020.08 / 0 | 27335 / 1871.56 | -25463.44 |
| VFL5397 | STAFF | 31 / 5 | 21711 / 3618 | 8684 / 1447 | 1511.16 / 251.76 | - / 0 | 200 / 0 | 8263.81 / 0 | 28264 / 3366.24 | -24897.76 |
| VFL5460 | STAFF | 31 / 6 | 21711 / 4344 | 8684 / 1737 | 1511.16 / 302.4 | - / 0 | 200 / 0 | 9734.48 / 0 | 28784 / 4041.6 | -24742.4 |
| VFL1064 | STAFF | 31 / 5 | 31500 / 5251 | 12600 / 2100 | 1800 / 365.4 | - / 0 | 200 / 0 | 0 / 0 | 29400 / 4885.6 | -24514.4 |
| VFL5405 | STAFF | 27 / 4 | 21718.45 / 3323 | 8687 / 1330 | 1511.52 / 231.24 | - / 0 | 200 / 0 | 8123.98 / 0 | 27341 / 3091.76 | -24249.24 |
| VFL1516 | STAFF | 31 / 4 | 21780 / 2903 | 8712 / 1162 | 1515.96 / 202.08 | - / 0 | 200 / 0 | 6744.77 / 0 | 26709 / 2700.92 | -24008.08 |
| VFL1327 | STAFF | 31 / 5 | 21711 / 3618 | 8684 / 1447 | 1511.16 / 251.76 | - / 0 | 200 / 0 | 6933.19 / 0 | 26933 / 3366.24 | -23566.76 |
| VFL1545 | STAFF | 31 / 5 | 30000 / 5000 | 12000 / 2000 | 1800 / 348 | - / 0 | 200 / 0 | 0 / 0 | 28000 / 4652 | -23348 |
| VFL1557 | STAFF | 31 / 1 | 27000 / 900 | 10800 / 360 | 1800 / 62.64 | - / 0 | 200 / 0 | 0 / 0 | 24040 / 837.36 | -23202.64 |
| VFL1290 | STAFF | 29 / 4 | 20310.29 / 2897 | 8124 / 1158 | 1413.72 / 201.6 | - / 0 | 200 / 0 | 6337.92 / 0 | 24944 / 2695.4 | -22248.6 |
| VFL1527 | STAFF | 31 / 5 | 18956 / 3160 | 7582 / 1264 | 1319.16 / 220.08 | 142 / 23.69 | 200 / 0 | 7459.71 / 0 | 24755 / 2916.23 | -21838.77 |
| VFL5463 | STAFF | 31 / 0 | 18480 / 0 | 7392 / 0 | 1286.28 / 0 | 139 / 0 | 200 / 0 | 5186.32 / 0 | 21646 / 0 | -21646 |
| VFL1066 | STAFF | 31 / 4 | 24200 / 3228 | 9680 / 1291 | 1684.32 / 224.76 | - / 0 | 200 / 0 | 8235.81 / 0 | 24543 / 3003.24 | -21539.76 |
| VFL5237 | STAFF | 31 / 1 | 17884 / 597 | 7154 / 238 | 1244.76 / 41.52 | 134 / 4.47 | 200 / 0 | 5538.58 / 0 | 21614 / 551.01 | -21062.99 |
| VFL5409 | STAFF | 30 / 0 | 17623.55 / 0 | 7049 / 0 | 1226.4 / 0 | 132 / 0 | 200 / 0 | 5580.79 / 0 | 20891 / 0 | -20891 |
| VFL5461 | STAFF | 24.5 / 4 | 26870.97 / 4533 | 10748 / 1813 | 1800 / 315.48 | - / 0 | 200 / 0 | 0 / 0 | 24671 / 4217.52 | -20453.48 |
| VFL5322 | STAFF | 31 / 5 | 18637 / 2818 | 7455 / 1127 | 1297.08 / 196.08 | 140 / 21.14 | 200 / 0 | 5621.31 / 0 | 22621 / 2600.78 | -20020.22 |
| VFL1453 | STAFF | 31 / 5 | 18795 / 3133 | 7518 / 1253 | 1308.24 / 218.04 | 141 / 23.49 | 200 / 0 | 5577.87 / 0 | 22589 / 2891.47 | -19697.53 |
| VFL1556 | STAFF | 31 / 3 | 19720 / 1769 | 7888 / 708 | 1372.44 / 123.12 | 148 / 13.28 | 200 / 0 | 3689.55 / 0 | 21329 / 1632.6 | -19696.4 |
| VFL1450 | STAFF | 31 / 5 | 19720 / 3287 | 7888 / 1315 | 1372.44 / 228.72 | 148 / 24.65 | 200 / 0 | 4643.74 / 0 | 22643 / 3033.63 | -19609.37 |
| VFL5462 | STAFF | 29.5 / 5 | 25493.71 / 4466 | 10197 / 1786 | 1774.44 / 310.8 | - / 0 | 200 / 0 | 0 / 0 | 23519 / 4155.2 | -19363.8 |
| VFL5448 | STAFF | 30 / 5 | 19608.39 / 3378 | 7843 / 1351 | 1364.88 / 235.2 | 147 / 25.33 | 200 / 0 | 4542.72 / 0 | 22439 / 3117.47 | -19321.53 |
| VFL1272 | STAFF | 28 / 4 | 24537.03 / 3621 | 9815 / 1449 | 1707.72 / 252 | - / 0 | 200 / 0 | 0 / 0 | 22629 / 3369 | -19260 |
| VFL5444 | STAFF | 31 / 5 | 20804 / 3467 | 8322 / 1387 | 1447.92 / 241.32 | 156 / 26.01 | 200 / 0 | 2751.63 / 0 | 21752 / 3199.67 | -18552.33 |
| VFL5347 | STAFF | 28 / 3 | 17405.16 / 1928 | 6962 / 771 | 1211.28 / 134.28 | 131 / 14.45 | 200 / 0 | 4568.85 / 0 | 19977 / 1779.27 | -18197.73 |
| VFL5450 | STAFF | 28.5 / 5 | 21936.73 / 3978 | 8775 / 1591 | 1526.76 / 276.96 | - / 0 | 200 / 0 | 1577.84 / 0 | 21788 / 3701.04 | -18086.96 |
| VFL5272 | STAFF | 31 / 0 | 17000 / 0 | 6800 / 0 | 1183.2 / 0 | 128 / 0 | 200 / 0 | 2495.16 / 0 | 17874 / 0 | -17874 |
| VFL5321 | STAFF | 31 / 5 | 16911 / 2818 | 6764 / 1127 | 1177.08 / 196.08 | 127 / 21.14 | 200 / 0 | 5018.75 / 0 | 20426 / 2600.78 | -17825.22 |
| VFL5379 | STAFF | 31 / 4 | 22786 / 3037 | 9114 / 1215 | 1585.8 / 211.32 | - / 0 | 200 / 0 | 0 / 0 | 20640 / 2825.68 | -17814.32 |
| VFL5273 | STAFF | 31 / 5 | 17000 / 2833 | 6800 / 1133 | 1183.2 / 197.16 | 128 / 21.25 | 200 / 0 | 4853.23 / 0 | 20342 / 2614.59 | -17727.41 |
| VFL5466 | STAFF | 29 / 2 | 16214.74 / 1154 | 6486 / 462 | 1128.6 / 80.28 | 122 / 8.67 | 200 / 0 | 4780.42 / 0 | 18770 / 1065.05 | -17704.95 |
| VFL1543 | STAFF | 31 / 5 | 22786 / 3798 | 9114 / 1519 | 1585.8 / 264.36 | - / 0 | 200 / 0 | 0 / 0 | 21000 / 3533.64 | -17466.36 |
| VFL5430 | STAFF | 31 / 5 | 17500 / 2918 | 7000 / 1167 | 1218 / 203.04 | 131 / 21.88 | 200 / 0 | 4036.29 / 0 | 19632 / 2693.08 | -16938.92 |
| VFL5400 | STAFF | 24 / 3 | 14880.77 / 1921 | 5952 / 769 | 1035.72 / 133.68 | 112 / 14.42 | 200 / 0 | 4960 / 0 | 18463 / 1772.9 | -16690.1 |
| VFL5465 | STAFF | 26 / 1 | 14537.35 / 579 | 5815 / 231 | 1011.72 / 40.32 | 109 / 4.33 | 200 / 0 | 4640.64 / 0 | 17202 / 534.35 | -16667.65 |
| VFL1482 | STAFF | 31 / 6 | 18000 / 3600 | 7200 / 1440 | 1252.8 / 250.56 | 135 / 27 | 200 / 0 | 3483.87 / 0 | 16896 / 322.44 | -16573.56 |
| VFL1562 | STAFF | 30.5 / 6 | 21889.16 / 4449 | 8756 / 1780 | 1523.4 / 309.72 | - / 0 | 200 / 0 | 502.36 / 0 | 20668 / 4139.28 | -16528.72 |
| VFL1564 | STAFF | 29.5 / 4 | 20660.47 / 2897 | 8264 / 1158 | 1438.08 / 201.6 | - / 0 | 200 / 0 | 0 / 0 | 19022 / 2695.4 | -16326.6 |
| VFL1549 | STAFF | 26.5 / 4 | 21154.69 / 3300 | 8462 / 1320 | 1472.28 / 229.68 | - / 0 | 200 / 0 | 0 / 0 | 19182 / 3070.32 | -16111.68 |
| VFL4057 | STAFF | 30 / 2 | 25149.68 / 1733 | 10060 / 693 | 1750.44 / 120.6 | - / 0 | 200 / 0 | 0 / 0 | 17241 / 1612.4 | -15628.6 |
| VFL5382 | STAFF | 31 / 0 | 16290 / 0 | 6516 / 0 | 1133.64 / 0 | 122 / 0 | 200 / 0 | 919.6 / 0 | 15494 / 0 | -15494 |
| VFL5446 | STAFF | 29.5 / 6 | 20455.87 / 4300 | 8182 / 1720 | 1423.56 / 299.28 | - / 0 | - / 0 | 0 / 0 | 19032 / 4000.72 | -15031.28 |
| VFL5413 | STAFF | 30 / 4 | 18648.39 / 2569 | 7459 / 1028 | 1297.92 / 178.8 | 140 / 19.27 | 200 / 0 | 217.56 / 0 | 17068 / 2370.93 | -14697.07 |
| VFL5442 | STAFF | 30 / 4 | 18035.81 / 2000 | 7214 / 800 | 1255.2 / 139.2 | 135 / 15 | 200 / 0 | 0 / 0 | 16446 / 1845.8 | -14600.2 |
| VFL5303 | STAFF | 31 / 5 | 19179 / 3198 | 7672 / 1279 | 1335 / 222.6 | 144 / 23.98 | 200 / 0 | 0 / 0 | 17500 / 2951.42 | -14548.58 |
| VFL5452 | STAFF | 30 / 5 | 15938.71 / 2746 | 6375 / 1098 | 1109.16 / 191.16 | 120 / 20.59 | 200 / 0 | 3904.98 / 0 | 17015 / 2534.25 | -14480.75 |
| VFL5457 | STAFF | 16 / 0 | 10737.55 / 0 | 4295 / 0 | 747.24 / 0 | 81 / 0 | 200 / 0 | 4530.12 / 0 | 14239 / 0 | -14239 |
| VFL5399 | STAFF | 28 / 5 | 16833.42 / 3106 | 6733 / 1243 | 1171.56 / 216.12 | 126 / 23.3 | 200 / 0 | 1593.21 / 0 | 16929 / 2866.58 | -14062.42 |
| VFL5440 | STAFF | 31 / 6 | 16253 / 3251 | 6501 / 1300 | 1131.12 / 226.2 | 122 / 24.38 | - / 0 | 0 / 0 | 15000 / 3000.42 | -11999.58 |
| VFL5451 | STAFF | 30 / 6 | 15938.71 / 3296 | 6375 / 1318 | 1109.16 / 229.44 | 120 / 24.71 | 200 / 0 | 0 / 0 | 14510 / 3041.85 | -11468.15 |
| VFL5433 | STAFF | 23 / 4 | 14229.58 / 2556 | 5692 / 1023 | 990.48 / 177.84 | 107 / 19.18 | 200 / 0 | 835.26 / 0 | 13427 / 2358.98 | -11068.02 |
| VFL5449 | STAFF | 27 / 5 | 14344.84 / 2746 | 5738 / 1098 | 998.52 / 191.16 | 108 / 20.59 | 200 / 0 | 0 / 0 | 13038 / 2534.25 | -10503.75 |
| VFL5454 | STAFF | 29 / 6 | 14670.26 / 3136 | 5868 / 1255 | 1020.96 / 218.28 | 110 / 23.52 | 200 / 0 | 0 / 0 | 13339 / 2894.2 | -10444.8 |
| VFL5447 | STAFF | 28 / 4 | 12918.84 / 1906 | 5168 / 763 | 899.16 / 132.6 | 97 / 14.3 | 200 / 0 | 0 / 0 | 11723 / 1759.1 | -9963.9 |
| VFL5434 | STAFF | 22 / 4 | 12419.35 / 2333 | 4968 / 933 | 864.36 / 162.36 | 93 / 17.5 | 200 / 0 | 0 / 0 | 11062 / 2153.14 | -8908.86 |
| VFL4033 | PERMANENT_WORKER | 11 / 6 | 28859 / 7366.94 | 6666 / 3636 | 924 / 510.48 | - / - | 200 / 0 | 6954.75 / 0 | 15018 / 6856.46 | -8161.54 |
| VFL5459 | STAFF | 17 / 6 | 11906.03 / 4344 | 4762 / 1737 | 828.48 / 302.4 | - / 0 | 200 / 0 | 0 / 0 | 10828 / 4041.6 | -6786.4 |

---

# Payroll engine offline test, September 2026

> **INTERNAL: contains individual salary figures. Do not share outside HR / owner.**

- **Date run:** 20 Oct 2026
- **Branch / worktree:** `claude/payroll-lifecycle` (vendored engine in `supabase/functions/payroll-run/lib/`)
- **Method:** offline and read-only. Inputs were pulled with SELECT-only SQL, saved as JSON fixtures (outside the repo), then the `calculate` call path of `supabase/functions/payroll-run/index.ts` was replicated exactly: `assemblePayrollInputs(2026, 9, feeds)` followed by `calculateOne(input)` with `DEFAULT_ENGINE_CONFIG` per input. The vendored `lib/feedSync.ts` and `lib/engine.ts` were imported unmodified. **No DB writes, no edge-function or HTTP call, no deploy, no git state change.** No bank / PAN / Aadhaar / UAN data was read.
- **Not replicated (not available offline):** raw `check_in_time`/`check_out_time` values (only a present/absent punch flag was kept; they affect only the reconciliation list, not pay); `punches` is `[]` exactly as the runner passes it.

## 1. Inputs (same filters as the runner)

The runner reads whole tables and filters inside `feedSync`. Counts below are what it would have seen:

| Input | Query | Rows |
|---|---|---|
| employees | all (154); `feedSync` skips inactive with no status history -> 99 active used | 154 (99 active, 55 inactive) |
| employee_salary_structure | all; picked `effective_from <= 2026-09-30` | 96 (all 96 qualify) |
| attendance_records | `date` 2026-09-01..2026-09-30 | 381 rows, 88 employees, range 2026-09-04..2026-09-30; **0 rows with overtime_hours > 0** |
| leave_requests | all, `status = approved` used | 1 row (pending) -> 0 approved |
| advance_requests | all, `status = approved` used | 9 rows, 7 approved |
| payroll_canteen_entries (2026-09) | | **0** |
| payroll_society_recoveries (2026-09) | | **0** |
| payroll_efficiency_entries (2026-09) | | **0** |
| payroll_adjustments (2026-09) | | **0** |
| employee_status_history | all | **0** |

All four PATCH_91 feed tables are empty for `2026-09` (confirmed by `count(*)`), so there is no pending-feed gate and every worker gets `EFFICIENCY_MISSING`.

## 2. Summary

- Engine inputs: 99 (blocked by lifecycle: 0); calculated 82; **held 17**.
- Archived September items: 101. Matched by emp_code: 97 ("both"), of which engine HELD 15, comparable 82. **Only archived: 4** (BUNG02, BUNG09, BUNG30, BUNG33). **Only engine: 2** (VFL1001, VFL1520).

| Totals | Archived | Engine |
|---|---:|---:|
| All rows (archived 101 / engine 82 calculated) gross | 28,42,595.63 | 3,18,060.44 |
| All rows net | 27,75,450 | 2,82,149.2 |
| 82 comparable employees gross | 24,70,460.79 | 3,18,060.44 |
| 82 comparable employees net | 23,90,616 | 2,82,149.2 |

Note on "gross": archived **staff** `totalEarnings` is the fixed gross *excluding* OT (net = gross + OT - deductions), whereas archived **worker** and all **engine** `totalEarnings` include OT. Compare nets for totals; use the normalised check in section 4 for like-for-like lines.

## 3. Full comparison table (A = archived, E = engine; largest net gap first)

| Emp | Name | Cat | Side | Paid A | Paid E | Gross A | Gross E | Basic A | Basic E | PF A | PF E | ESI A | ESI E | PT A | PT E | OT A | OT E | Net A | Net E | Net diff (E-A) |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| VFL1386 | Fazal Ilahi Khan | STAFF | both | 31 | 6 | 1,48,706 | 31,667 | 59,482 | 12,667 | 1,800 | 1,800 | - | 0 | 200 | 200 | 0 | 0 | 1,36,706 | 29,667 | -1,07,039 |
| VFL1463 | Dinkar Landge | STAFF | both | 31 | 4 | 57,750 | 8,346 | 23,100 | 3,338 | 1,800 | 580.92 | - | 0 | 200 | 175 | 0 | 0 | 95,750 | 7,590.08 | -88,159.92 |
| VFL4026 | Parbhansh Tameshwar Yadav | PERMANENT_WORKER | both | 26 | 0 | 59,044 | 0 | 15,756 | 0 | 1,800 | 0 | - | - | 200 | 0 | 18,724.33 | 0 | 52,771 | 0 | -52,771 |
| VFL1560 | Shaikh Majeed | STAFF | both | 31 | 4 | 62,000 | 8,944 | 24,800 | 3,577 | 1,800 | 622.56 | - | 0 | 200 | 175 | 0 | 0 | 60,000 | 8,146.44 | -51,853.56 |
| VFL4011 | Banwari Harihar Yadav | PERMANENT_WORKER | both | 26 | 0 | 56,992 | 0 | 15,756 | 0 | 1,800 | 0 | - | - | 200 | 0 | 16,762.73 | 0 | 50,546 | 0 | -50,546 |
| VFL4025 | Raghav Harihar Yadav | PERMANENT_WORKER | both | 26 | 1 | 55,407 | 1,228.03 | 15,756 | 606 | 1,800 | 85.08 | - | - | 200 | 0 | 14,979.46 | 0 | 49,307 | 1,142.95 | -48,164.05 |
| VFL4036 | Bhagwan Revji Walunj | PERMANENT_WORKER | both | 26 | 3 | 56,633 | 3,682.97 | 15,756 | 1,818 | 1,800 | 255.24 | - | - | 200 | 0 | 16,316.91 | 0 | 50,460 | 3,427.73 | -47,032.27 |
| VFL4042 | Rajkumar Vyankatrao Amge | PERMANENT_WORKER | both | 26 | 3 | 58,348 | 3,632.36 | 15,756 | 1,818 | 1,800 | 255.24 | - | - | 200 | 0 | 18,367.67 | 0 | 47,560 | 3,377.12 | -44,182.88 |
| VFL4068 | Subhash Ramji Rathod | PERMANENT_WORKER | both | 26 | 3 | 53,737 | 3,515.11 | 15,756 | 1,818 | 1,800 | 255.24 | - | - | 200 | 0 | 14,979.46 | 0 | 46,746 | 3,259.87 | -43,486.13 |
| VFL4012 | Kailas Ramdas Darandale | PERMANENT_WORKER | both | 26 | 0 | 48,547 | 0 | 15,756 | 0 | 1,800 | 0 | - | - | 200 | 0 | 8,381.37 | 0 | 42,274 | 0 | -42,274 |
| VFL1528 | Bhupendra Kashinath Bharude | STAFF | both | 31 | 6 | 55,290 | 12,000 | 22,116 | 4,800 | 1,800 | 835.2 | - | 0 | 200 | 200 | 0 | 0 | 47,895 | 5,964.8 | -41,930.2 |
| VFL4063 | Shivaji Hanumantrao Dangat | PERMANENT_WORKER | both | 26 | 6 | 55,727 | 6,995.53 | 15,756 | 3,636 | 1,800 | 510.48 | - | - | - | 0 | 17,119.38 | 0 | 46,211 | 6,485.05 | -39,725.95 |
| VFL4041 | Sharad Kisan Dargude | PERMANENT_WORKER | both | 26 | 4 | 56,295 | 4,888.24 | 15,756 | 2,424 | 1,800 | 340.32 | - | - | 200 | 0 | 16,227.75 | 0 | 44,021 | 4,547.92 | -39,473.08 |
| VFL4045 | Madhav Laxman Bhande | PERMANENT_WORKER | both | 26 | 4 | 56,068 | 4,812.22 | 15,756 | 2,424 | 1,800 | 340.32 | - | - | 200 | 0 | 16,495.24 | 0 | 43,169 | 4,471.9 | -38,697.1 |
| VFL4065 | Ramrao Shrawan Bansode | PERMANENT_WORKER | both | 26 | 4 | 54,704 | 4,686.8 | 15,756 | 2,424 | 1,800 | 340.32 | - | - | 200 | 0 | 16,049.42 | 0 | 41,652 | 4,346.48 | -37,305.52 |
| VFL5439 | Bhanwar Singh Rathod | STAFF | both | 31 | 0 | 23,048 | 0 | 9,219 | - | 1,604.16 | - | - | - | 200 | - | 15,464.13 | 0 | 36,708 | 0 | -36,708 |
| VFL4008 | Dnyaneshwar Nivrutti Harishchandre | PERMANENT_WORKER | both | 26 | 5 | 52,827 | 6,109.39 | 15,756 | 3,030 | 1,800 | 425.4 | - | - | 200 | 0 | 12,661.21 | 0 | 41,851 | 5,683.99 | -36,167.01 |
| VFL1566 | Abhimanyu Kakde | STAFF | both | 31 | 5 | 45,000 | 7,500 | 18,000 | 3,000 | 1,800 | 522 | - | 0 | 200 | 0 | 0 | 0 | 42,600 | 6,978 | -35,622 |
| VFL1391 | Atul Bhata Patil | STAFF | both | 31 | 5 | 28,000 | 5,212 | 11,200 | 2,085 | 1,800 | 362.88 | - | 0 | 200 | 0 | 14,180.65 | 0 | 40,181 | 4,849.12 | -35,331.88 |
| VFL5324 | Shivaji Suresh Jaypure | STAFF | both | 31 | 6 | 26,000 | 5,834 | 10,400 | 2,334 | 1,800 | 406.08 | - | 0 | 200 | 0 | 11,825.81 | 0 | 35,826 | 5,427.92 | -30,398.08 |
| VFL4024 | Ramesh Sitaram Sharma | PERMANENT_WORKER | both | 21 | 4 | 48,095 | 4,909.68 | 12,726 | 2,424 | 1,787 | 340.32 | - | - | 200 | 0 | 13,820.34 | 0 | 34,600 | 4,569.36 | -30,030.64 |
| VFL4032 | Vitthal Kondiba Kanade | PERMANENT_WORKER | both | 26 | 5 | 41,527 | 6,111.3 | 15,756 | 3,030 | 1,800 | 425.4 | - | - | 200 | 0 | 1,248.29 | 0 | 35,352 | 5,685.9 | -29,666.1 |
| VFL4066 | Nitin Rajendra Boralkar | PERMANENT_WORKER | both | 26 | 4 | 40,288 | 4,686.8 | 15,756 | 2,424 | 1,800 | 340.32 | - | - | 200 | 0 | 1,426.62 | 0 | 33,900 | 4,346.48 | -29,553.52 |
| VFL5302 | Nanasaheb Dinkar Shinde | STAFF | both | 31 | 4 | 27,000 | 4,031 | 10,800 | 1,612 | 1,800 | 280.56 | - | 0 | 200 | 0 | 7,533.87 | 0 | 32,059 | 3,750.44 | -28,308.56 |
| VFL1446 | Dharmendra Prabhu Mahto | STAFF | both | 31 | 5 | 24,936 | 4,688 | 9,974 | 1,875 | 1,735.44 | 326.16 | - | 0 | 200 | 0 | 9,652.26 | 0 | 32,653 | 4,361.84 | -28,291.16 |
| VFL4043 | Uttam Kacharu Bhadgal | PERMANENT_WORKER | both | 26 | 2 | 43,822 | 2,406.96 | 15,756 | 1,212 | 1,800 | 170.16 | - | - | 200 | 0 | 4,547.34 | 0 | 29,894 | 2,236.8 | -27,657.2 |
| VFL4072 | Gundappa Mahadeo Nadde | PERMANENT_WORKER | both | 26 | 0 | 39,485 | 0 | 15,756 | 0 | 1,800 | 0 | - | - | 200 | 0 | 624.14 | 0 | 26,339 | 0 | -26,339 |
| VFL4071 | Baburao Sambhaji Bakwad | PERMANENT_WORKER | both | 26 | 3 | 39,663 | 3,515.11 | 15,756 | 1,818 | 1,800 | 255.24 | - | - | 200 | 0 | 802.47 | 0 | 29,205 | 3,259.87 | -25,945.13 |
| VFL5318 | Gorakh Sitaram More | STAFF | both | 31 | 3 | 20,262 | 2,352 | 8,105 | 941 | 1,410.36 | 163.68 | 152 | 0 | 200 | 0 | 9,020.08 | 0 | 27,335 | 2,188.32 | -25,146.68 |
| VFL5397 | Amol Rakhmaji Ambhore | STAFF | both | 31 | 5 | 21,711 | 4,082 | 8,684 | 1,633 | 1,511.16 | 284.16 | - | 0 | 200 | 0 | 8,263.81 | 0 | 28,264 | 3,797.84 | -24,466.16 |
| VFL1064 | Balasaheb Shivaji Todmal | STAFF | both | 31 | 5 | 31,500 | 5,827 | 12,600 | 2,330 | 1,800 | 405.6 | - | 0 | 200 | 0 | 0 | 0 | 29,400 | 5,421.4 | -23,978.6 |
| VFL5405 | Sunil Ramakant Saha | STAFF | both | 27 | 4 | 21,718.45 | 3,751 | 8,687 | 1,500 | 1,511.52 | 261 | - | 0 | 200 | 0 | 8,123.98 | 0 | 27,341 | 3,490 | -23,851 |
| VFL1516 | Subhash Sitaram Palve | STAFF | both | 31 | 4 | 21,780 | 3,277 | 8,712 | 1,310 | 1,515.96 | 228.12 | - | 0 | 200 | 0 | 6,744.77 | 0 | 26,709 | 3,048.88 | -23,660.12 |
| VFL1327 | Santosh Vishwanath Sawai | STAFF | both | 31 | 5 | 21,711 | 4,082 | 8,684 | 1,633 | 1,511.16 | 284.16 | - | 0 | 200 | 0 | 6,933.19 | 0 | 26,933 | 3,797.84 | -23,135.16 |
| VFL1557 | Milind Ambadas Barhate | STAFF | both | 31 | 1 | 27,000 | 1,006 | 10,800 | 403 | 1,800 | 69.96 | - | 0 | 200 | 0 | 0 | 0 | 24,040 | 936.04 | -23,103.96 |
| VFL1545 | Shaikh Mujahed Shaikh Naeem | STAFF | both | 31 | 5 | 30,000 | 5,564 | 12,000 | 2,225 | 1,800 | 387.24 | - | 0 | 200 | 0 | 0 | 0 | 28,000 | 5,176.76 | -22,823.24 |
| VFL1290 | Pravin Pundalik Sonavane | STAFF | both | 29 | 4 | 20,310.29 | 3,266 | 8,124 | 1,306 | 1,413.72 | 227.28 | - | 0 | 200 | 0 | 6,337.92 | 0 | 24,944 | 3,038.72 | -21,905.28 |
| VFL5463 | Manoj Anantrao Wagh | STAFF | both | 31 | 0 | 18,480 | 0 | 7,392 | 0 | 1,286.28 | 0 | 139 | 0 | 200 | 0 | 5,186.32 | 0 | 21,646 | 0 | -21,646 |
| VFL1389 | Tushar Abasaheb Shirgire | STAFF | both | 31 | 6 | 29,000 | 5,886 | 11,600 | 2,354 | 1,800 | 409.56 | - | 0 | 200 | 0 | 0 | 0 | 22,000 | 476.44 | -21,523.56 |
| VFL1527 | Sharwan Singh Jodha | STAFF | both | 31 | 5 | 18,956 | 3,667 | 7,582 | 1,467 | 1,319.16 | 255.24 | 142 | 0 | 200 | 0 | 7,459.71 | 0 | 24,755 | 3,411.76 | -21,343.24 |
| VFL1066 | Ramnath Babasaheb Gadekar | STAFF | both | 31 | 4 | 24,200 | 3,640 | 9,680 | 1,456 | 1,684.32 | 253.2 | - | 0 | 200 | 0 | 8,235.81 | 0 | 24,543 | 3,386.8 | -21,156.2 |
| VFL5237 | Saroj Avdesh Singh | STAFF | both | 31 | 1 | 17,884 | 694 | 7,154 | 277 | 1,244.76 | 48.36 | 134 | 5.19 | 200 | 0 | 5,538.58 | 0 | 21,614 | 640.45 | -20,973.55 |
| VFL5409 | Dilip Pralhad Arak | STAFF | both | 30 | 0 | 17,623.55 | 0 | 7,049 | 0 | 1,226.4 | 0 | 132 | 0 | 200 | 0 | 5,580.79 | 0 | 20,891 | 0 | -20,891 |
| VFL5322 | Jakir Munshi Chaudhari | STAFF | both | 31 | 5 | 18,637 | 3,269 | 7,455 | 1,308 | 1,297.08 | 227.52 | 140 | 24.53 | 200 | 0 | 5,621.31 | 0 | 22,621 | 3,016.95 | -19,604.05 |
| VFL1556 | Shyambabu Radheshyam Yadav | STAFF | both | 31 | 3 | 19,720 | 2,054 | 7,888 | 822 | 1,372.44 | 142.92 | 148 | 15.41 | 200 | 0 | 3,689.55 | 0 | 21,329 | 1,895.67 | -19,433.33 |
| VFL1453 | Laxman Yadav | STAFF | both | 31 | 5 | 18,795 | 3,634 | 7,518 | 1,454 | 1,308.24 | 252.96 | 141 | 0 | 200 | 0 | 5,577.87 | 0 | 22,589 | 3,381.04 | -19,207.96 |
| VFL1450 | Kishan Suresh Giri | STAFF | both | 31 | 5 | 19,720 | 3,814 | 7,888 | 1,526 | 1,372.44 | 265.56 | 148 | 0 | 200 | 0 | 4,643.74 | 0 | 22,643 | 3,548.44 | -19,094.56 |
| VFL1272 | Haribhau Shamrao Datar | STAFF | both | 28 | 4 | 24,537.03 | 4,053 | 9,815 | 1,621 | 1,707.72 | 282 | - | 0 | 200 | 0 | 0 | 0 | 22,629 | 3,771 | -18,858 |
| VFL5448 | Vijay Rangnath Sonawane | STAFF | both | 30 | 5 | 19,608.39 | 3,920 | 7,843 | 1,568 | 1,364.88 | 272.76 | 147 | 0 | 200 | 0 | 4,542.72 | 0 | 22,439 | 3,647.24 | -18,791.76 |
| VFL5444 | Subhash Shivanand Thorat | STAFF | both | 31 | 5 | 20,804 | 4,023 | 8,322 | 1,610 | 1,447.92 | 279.96 | 156 | 0 | 200 | 0 | 2,751.63 | 0 | 21,752 | 3,743.04 | -18,008.96 |
| VFL5347 | Rajdev Narpat Prasad | STAFF | both | 28 | 3 | 17,405.16 | 2,236 | 6,962 | 895 | 1,211.28 | 155.64 | 131 | 0 | 200 | 0 | 4,568.85 | 0 | 19,977 | 2,080.36 | -17,896.64 |
| VFL5272 | Ramesh Narayan Gote | STAFF | both | 31 | 0 | 17,000 | 0 | 6,800 | 0 | 1,183.2 | 0 | 128 | 0 | 200 | 0 | 2,495.16 | 0 | 17,874 | 0 | -17,874 |
| VFL5466 | Suresh Ambhore | STAFF | both | 29 | 2 | 16,214.74 | 1,154 | 6,486 | 462 | 1,128.6 | 80.28 | 122 | 8.67 | 200 | 0 | 4,780.42 | 0 | 18,770 | 1,065.05 | -17,704.95 |
| VFL5450 | Sayed Uzaif Ali | STAFF | both | 28.5 | 5 | 21,936.73 | 4,487 | 8,775 | 1,795 | 1,526.76 | 312.24 | - | 0 | 200 | 0 | 1,577.84 | 0 | 21,788 | 4,174.76 | -17,613.24 |
| VFL5379 | Gaurav Deelip Kakde | STAFF | both | 31 | 4 | 22,786 | 3,429 | 9,114 | 1,371 | 1,585.8 | 238.68 | - | 0 | 200 | 0 | 0 | 0 | 20,640 | 3,190.32 | -17,449.68 |
| VFL5321 | Bhaiyyasaheb Sambhaji Patil | STAFF | both | 31 | 5 | 16,911 | 3,269 | 6,764 | 1,308 | 1,177.08 | 227.52 | 127 | 24.53 | 200 | 0 | 5,018.75 | 0 | 20,426 | 3,016.95 | -17,409.05 |
| VFL5273 | Anna Pralhad Deshmukh | STAFF | both | 31 | 5 | 17,000 | 3,288 | 6,800 | 1,315 | 1,183.2 | 228.72 | 128 | 24.66 | 200 | 0 | 4,853.23 | 0 | 20,342 | 3,034.62 | -17,307.38 |
| VFL1543 | Shaikh Mobin Shaikh Sultan | STAFF | both | 31 | 5 | 22,786 | 4,285 | 9,114 | 1,714 | 1,585.8 | 298.2 | - | 0 | 200 | 0 | 0 | 0 | 21,000 | 3,986.8 | -17,013.2 |
| VFL5465 | Jogindra Yadav | STAFF | both | 26 | 1 | 14,537.35 | 579 | 5,815 | 231 | 1,011.72 | 40.32 | 109 | 4.33 | 200 | 0 | 4,640.64 | 0 | 17,202 | 534.35 | -16,667.65 |
| VFL5430 | Kisan Ashok Waghule | STAFF | both | 31 | 5 | 17,500 | 3,385 | 7,000 | 1,354 | 1,218 | 235.56 | 131 | 25.39 | 200 | 0 | 4,036.29 | 0 | 19,632 | 3,124.05 | -16,507.95 |
| VFL5400 | Manbodh Sambhu Sah | STAFF | both | 24 | 3 | 14,880.77 | 2,231 | 5,952 | 892 | 1,035.72 | 155.28 | 112 | 0 | 200 | 0 | 4,960 | 0 | 18,463 | 2,075.72 | -16,387.28 |
| VFL1482 | Brahmanand Kaduba Tajne | STAFF | both | 31 | 6 | 18,000 | 4,179 | 7,200 | 1,671 | 1,252.8 | 290.88 | 135 | 31.33 | 200 | 0 | 3,483.87 | 0 | 16,896 | 856.79 | -16,039.21 |
| VFL1562 | Sachin Suresh Rathod | STAFF | both | 30.5 | 6 | 21,889.16 | 5,020 | 8,756 | 2,008 | 1,523.4 | 349.32 | - | 0 | 200 | 0 | 502.36 | 0 | 20,668 | 4,670.68 | -15,997.32 |
| VFL1564 | Syed Inzamam Ali | STAFF | both | 29.5 | 4 | 20,660.47 | 3,266 | 8,264 | 1,306 | 1,438.08 | 227.28 | - | 0 | 200 | 0 | 0 | 0 | 19,022 | 3,038.72 | -15,983.28 |
| VFL1549 | Shaikh Wajid Shaikh Shabbir | STAFF | both | 26.5 | 4 | 21,154.69 | 3,721 | 8,462 | 1,489 | 1,472.28 | 258.96 | - | 0 | 200 | 0 | 0 | 0 | 19,182 | 3,462.04 | -15,719.96 |
| VFL5382 | Vitthal Uddhav Tekale | STAFF | both | 31 | 0 | 16,290 | 0 | 6,516 | 0 | 1,133.64 | 0 | 122 | 0 | 200 | 0 | 919.6 | 0 | 15,494 | 0 | -15,494 |
| VFL4057 | Devendrakumar Jagdish Singh | STAFF | both | 30 | 2 | 25,149.68 | 1,944 | 10,060 | 777 | 1,750.44 | 135.36 | - | 0 | 200 | 0 | 0 | 0 | 17,241 | 1,808.64 | -15,432.36 |
| VFL5446 | Mayuri Sardar Rathod | STAFF | both | 29.5 | 6 | 20,455.87 | 4,851 | 8,182 | 1,940 | 1,423.56 | 337.56 | - | 0 | - | 0 | 0 | 0 | 19,032 | 4,513.44 | -14,518.56 |
| VFL5442 | Darshan Anil Alhat | STAFF | both | 30 | 4 | 18,035.81 | 2,320 | 7,214 | 928 | 1,255.2 | 161.4 | 135 | 17.41 | 200 | 0 | 0 | 0 | 16,446 | 2,141.19 | -14,304.81 |
| VFL5413 | Sachin Somnath Parmeshwar | STAFF | both | 30 | 4 | 18,648.39 | 2,982 | 7,459 | 1,193 | 1,297.92 | 207.6 | 140 | 0 | 200 | 0 | 217.56 | 0 | 17,068 | 2,774.4 | -14,293.6 |
| VFL5457 | Sandip Tryambak Landage | STAFF | both | 16 | 0 | 10,737.55 | 0 | 4,295 | 0 | 747.24 | 0 | 81 | 0 | 200 | 0 | 4,530.12 | 0 | 14,239 | 0 | -14,239 |
| VFL5452 | Bholanath Das | STAFF | both | 30 | 5 | 15,938.71 | 3,186 | 6,375 | 1,274 | 1,109.16 | 221.64 | 120 | 23.89 | 200 | 0 | 3,904.98 | 0 | 17,015 | 2,940.47 | -14,074.53 |
| VFL5303 | Dilip Sanjay Ghegde | STAFF | both | 31 | 5 | 19,179 | 3,710 | 7,672 | 1,484 | 1,335 | 258.36 | 144 | 0 | 200 | 0 | 0 | 0 | 17,500 | 3,451.64 | -14,048.36 |
| VFL5399 | Chandan Milind Sonapasare | STAFF | both | 28 | 5 | 16,833.42 | 3,603 | 6,733 | 1,442 | 1,171.56 | 250.8 | 126 | 0 | 200 | 0 | 1,593.21 | 0 | 16,929 | 3,352.2 | -13,576.8 |
| VFL5440 | Pallavi Vishnu Khade | STAFF | both | 31 | 6 | 16,253 | 3,771 | 6,501 | 1,509 | 1,131.12 | 262.44 | 122 | 28.29 | - | 0 | 0 | 0 | 15,000 | 3,480.27 | -11,519.73 |
| VFL5451 | Ezaan Ahmed Khan | STAFF | both | 30 | 6 | 15,938.71 | 3,822 | 6,375 | 1,529 | 1,109.16 | 265.92 | 120 | 28.67 | 200 | 0 | 0 | 0 | 14,510 | 3,527.41 | -10,982.59 |
| VFL5433 | Aniket Kailas Taru | STAFF | both | 23 | 4 | 14,229.58 | 2,967 | 5,692 | 1,187 | 990.48 | 206.52 | 107 | 0 | 200 | 0 | 835.26 | 0 | 13,427 | 2,760.48 | -10,666.52 |
| VFL5449 | Siddiqui Mohd Zainul Abedin | STAFF | both | 27 | 5 | 14,344.84 | 3,186 | 5,738 | 1,274 | 998.52 | 221.64 | 108 | 23.89 | 200 | 0 | 0 | 0 | 13,038 | 2,940.47 | -10,097.53 |
| VFL5454 | Shaikh Tohid Yunus | STAFF | both | 29 | 6 | 14,670.26 | 3,640 | 5,868 | 1,456 | 1,020.96 | 253.2 | 110 | 27.3 | 200 | 0 | 0 | 0 | 13,339 | 3,359.5 | -9,979.5 |
| VFL5447 | Sarang Kishor Shinde | STAFF | both | 28 | 4 | 12,918.84 | 2,213 | 5,168 | 885 | 899.16 | 154.08 | 97 | 16.6 | 200 | 0 | 0 | 0 | 11,723 | 2,042.32 | -9,680.68 |
| VFL5434 | Amit Bhagvan Shirsath | STAFF | both | 22 | 4 | 12,419.35 | 2,706 | 4,968 | 1,083 | 864.36 | 188.28 | 93 | 20.31 | 200 | 0 | 0 | 0 | 11,062 | 2,497.41 | -8,564.59 |
| VFL4033 | Bireshkumar Jagdish Singh | PERMANENT_WORKER | both | 11 | 6 | 28,859 | 7,366.94 | 6,666 | 3,636 | 924 | 510.48 | - | - | 200 | 0 | 6,954.75 | 0 | 15,018 | 6,856.46 | -8,161.54 |

### Engine HELD (no engine net)

| Emp | Name | Cat | Archived paid days | Archived net | Engine held reason | Cause |
|---|---|---|---:|---:|---|---|
| CON01 | Chhagan D Dehade | CONSULTANT | 26 | 26,863 | MISSING_RATE | (e) consultant: no salary structure row |
| CON05 | Madhukar Shamgir Gosavi | CONSULTANT | 21.5 | 13,871 | MISSING_RATE | (e) consultant: no salary structure row |
| CON09 | Nagnath Damu Kale | CONSULTANT | 26 | 19,290 | MISSING_RATE | (e) consultant: no salary structure row |
| CON12 | Sadashiv Nitalaksha Soddy | CONSULTANT | 31 | 48,000 | MISSING_RATE | (e) consultant: no salary structure row |
| CON13 | Sanjeev Pandurang Supsande | CONSULTANT | 31 | 55,000 | MISSING_RATE | (e) consultant: no salary structure row |
| CON20 | Prabhuling Ramchandra Achaleri | CONSULTANT | 24 | 23,146 | MISSING_RATE | (e) consultant: no salary structure row |
| CON24 | Shriram Pawar | CONSULTANT | 24 | 12,188 | MISSING_RATE | (e) consultant: no salary structure row |
| VFL1567 | Kajal Balkrishna Sutar | STAFF | 29 | 14,639 | NET_NEGATIVE | (a) very few app-attendance days vs fixed advance deduction |
| VFL5079 | Sudeep Singh | STAFF | 31 | 23,850 | NET_NEGATIVE | (a) very few app-attendance days vs fixed advance deduction |
| VFL5458 | Shaikh Irfan | STAFF | 30 | 31,723 | MISSING_MASTERS | U1: salary row exists but `ctc_annual = 0` so FIXED_GROSS undefined |
| VFL5459 | Vaibhav Mali | STAFF | 17 | 10,828 | MISSING_MASTERS | U1: salary row exists but `ctc_annual = 0` so FIXED_GROSS undefined |
| VFL5460 | Ashok Kumar | STAFF | 31 | 28,784 | MISSING_MASTERS | U1: salary row exists but `ctc_annual = 0` so FIXED_GROSS undefined |
| VFL5461 | Shaikh Hafizuddin Tamizuddin | STAFF | 24.5 | 24,671 | MISSING_MASTERS | U1: salary row exists but `ctc_annual = 0` so FIXED_GROSS undefined |
| VFL5462 | Bharat Vasantrao Salve | STAFF | 29.5 | 23,519 | MISSING_MASTERS | U1: salary row exists but `ctc_annual = 0` so FIXED_GROSS undefined |
| VFL5464 | Nidhi Kumari | STAFF | 30 | 27,032 | MISSING_MASTERS | U7: no `employee_salary_structure` row at all (feed warning) |
| VFL1001 | Yash Jinendra Munot | STAFF | - | - | MISSING_MASTERS | (e) owner structure row is all zeros |
| VFL1520 | Shrawan Rewant Singh | STAFF | - | - | NET_NEGATIVE | (a) very few app-attendance days vs fixed advance deduction |

### Only in archived (no engine row)

| Emp | Name | Cat | Net A | Cause |
|---|---|---|---:|---|
| BUNG02 | Lata Raghunath Misal | PUNE_STAFF | 2,000 | (d) inactive, no longer in the active roster |
| BUNG09 | Ashok Anandu Bontawar | PUNE_STAFF | -2,000 | (d) inactive, no longer in the active roster |
| BUNG30 | Pankaj Bansi Ghisadi | PUNE_STAFF | 800 | (d) inactive, no longer in the active roster |
| BUNG33 | Pravin Sampat Gaikwad | PUNE_STAFF | 630 | (d) inactive, no longer in the active roster |

### Only in engine

- VFL1001 Yash Jinendra Munot: engine HELD (MISSING_MASTERS); not in the archived September run.
- VFL1520 Shrawan Rewant Singh: engine HELD (NET_NEGATIVE); not in the archived September run.

## 4. Classification of gaps larger than Rs 500

All 82 comparable employees exceed Rs 500. Every one of them is explained at the top level by the known causes: **(a)** app attendance exists only from ~24-26 Sep (median engine paid days 4 vs ~31 archived), and the app has **0 overtime hours** captured for September, so all archived OT (staff and worker) is absent; **(b)** all 19 workers got `EFFICIENCY_MISSING` so `PROD_ALLOWANCE` is 0 (archived 8,500 each, with a `PROD_OFFSET` deduction); **(c)** engine worker OT uses the current VDA basis (103 x 26 = 2,678) vs the frozen 2,790 in the sheet (about 0.6% lower OT). Because the expected causes swamp everything, the real question is whether anything is wrong *beyond* them. To answer that I re-ran the engine on each employee with the **archived paid days, OT hours and an 85% efficiency injected** (diagnostic only; same code, same masters) and compared line items. Results:

**Workers (19): engine math reproduces the sheet.** Basic matches for all; gross within about 0.2% (VDA-for-OT difference, cause (c)); PF 1,800 matches 18/19; PT matches 18/19. Exceptions are U4 and U5 below.

**Staff: not reproducible with the masters as stored.** With archived days injected the engine's gross, Basic and OT are 7-50% above the sheet for 60+ staff and ESI/PF disagree; the cause is U1/U2/U6 below, not the attendance gap.

### UNEXPECTED (not covered by causes a-e)

1. **U1: staff FIXED_GROSS taken from `ctc_annual / 12` is wrong for legacy staff.** `feedSync.mastersFrom` sets `FIXED_GROSS = ctc_annual / 12`. For 61 active Aurangabad staff, `ctc_annual/12` is 10-16% above the monthly gross the September sheet paid (the stored `ctc_annual` evidently includes employer contributions, e.g. VFL1064: ctc/12 = 34,956 vs sheet gross 31,500 = Basic 12,600 / 0.40). It equals the sheet only for 3 employees whose `ctc_annual` was set as 12 x monthly (VFL1566, VFL5465, VFL5466 and similar). Effects: engine gross, Basic, OT, PF all inflated; **ESI is switched off for people the sheet gave ESI** (rule uses FIXED_GROSS <= 21,000; sheet ESI 93-156 for ~30 staff, engine ESI 0). For staff, `Basic / 0.40` reproduces the sheet's fixed gross for 63 of 68 staff (to within Rs 2), so the structure table is fine and the `ctc_annual` mapping is the defect. Also 5 new hires (VFL5458, 5459, 5460, 5461, 5462) have `ctc_annual = 0` and are HELD with MISSING_MASTERS even though Basic/HRA are populated (the owner row VFL1001 is all zeros).
2. **U2: September staff pay-day basis is 31 in the sheet, 30 in the engine.** Archived staff paid days are 31.0 for a full month in a 30-day month, and every archived staff gross equals `FIXED_GROSS x w / 31` (e.g. VFL5409: w=30, gross 17,624 = 18,211 x 30/31). The engine uses calendar days (30), so OT per hour is about 3.3% higher (VFL1391 OT sheet 14,180.65 = 11,200/31/8 x 2 x 157; engine basis /30 gives 14,653) and a part-month proration differs by about 0.1%. Needs a decision: is 31 a sheet quirk or intended?
3. **U3: women PT exemption never fires.** `feedSync` sets `gender = emp.gender === 'F' ? 'F' : 'M'`, but `employees.gender` holds `female`/`male`. Result: VFL5440, VFL5446 (and VFL5464, VFL1567 Pune) are treated as men and get PT 200 where the sheet charged 0 (gross <= 25,000).
4. **U4: explicit PT-exempt list not wired.** `PayrollInput.ptExempt` exists (VFL4021/4014/4063) but `feedSync` never sets it. Archived VFL4063 has PT 0; engine charges 200.
5. **U5: worker production allowance proration.** Engine pays `min(slab, round(slab x present/wd))`. The sheet paid the full 8,500 to VFL4024 (21 days) and VFL4033 (11 days) with a larger `PROD_OFFSET` deduction instead. Engine at the same days gives 6,865 and 3,596. Policy question: prorate, or full allowance and offset?
6. **U6: salary master differs from the September sheet for five staff:** VFL1389 (master Basic 10,500 -> 26,250 vs sheet 29,000), VFL1556 (17,703 vs 19,720), VFL1566 (41,040 vs 45,000; its ctc/12 does match 45,000), VFL5322 (16,911 vs 18,637) and VFL5442 (15,000 vs 18,636). The 24-Sep structure load does not equal what September was paid for these.
7. **U7: VFL5464 Nidhi Kumari has no `employee_salary_structure` row** (feed warning "no salary structure"), so she is held, although the sheet paid her Rs 27,032. Not a departed or consultant case, so not covered by (e).

Expected-cause rows worth naming individually: VFL1386 (net diff -107,040) and VFL1463 (-88,160) are the largest gaps; both are (a) 6 and 4 app days vs 31, compounded by U1 (VFL1386 ctc/12 = 158,334 vs sheet 148,705). Largest worker gaps (VFL4026, VFL4011, VFL4012) are zero app days plus (b) and OT.

## 5. Statutory spot-checks (3 staff present on both sides)

Engine rules read from `engine.ts` / `types.ts` (not the wording in the brief):

- **PF** = 12% of PF wage where PF wage = prorated BASIC + CONVEYANCE + EDUCATION + MEDICAL (= 58% of prorated gross); if PF wage <= 15,000 then 12% x wage, else flat 1,800. This is **not** "12% x min(Basic, 15000)": the ceiling applies to the wage, and the wage is 58% of gross, not Basic alone. It matches the archived sheet (e.g. VFL1066 sheet PF 1,684.32 = 12% x 58% x 24,200).
- **ESI** (employee) = 0.75% x FIXED_GROSS x w / wd, applied only if the *fixed* monthly gross <= 21,000 (the check is on the master, not on the prorated gross).
- **PT** slab on prorated gross (OT excluded): <= 7,500 -> 0; <= 10,000 -> 175; otherwise 200 (300 in February); women with gross <= 25,000 -> 0 (broken by U3); `ptExempt` -> 0 (unwired, U4). September therefore gives 200 for any full-month staff gross above 10,000, as the sheet does. Note the engine has a 175 band that the brief did not mention.

### 5.1 VFL5237 Saroj Avdesh Singh (low gross; ESI-eligible case)

Engine (w = 1, wd = 30, FIXED_GROSS = 249,060/12 = 20,755): gross = 20,755 x 1/30 = 691.83, components rounded sum to 694 (BASIC 277). PF wage = 277 + 42 + 42 + 42 = 403 (<= 15,000) -> PF = 12% x 403 = **48.36**. ESI: 20,755 <= 21,000 -> 20,755 x 0.0075 / 30 x 1 = **5.19**. PT: 694 <= 7,500 -> **0**. Net 640.45. All lines follow the stated rules (low PT is a consequence of 1 app day).

Archived (w = 31, gross 17,884): PF wage = 58% x 17,884 = 10,372.7 -> PF 12% = 1,244.7 (sheet 1,244.76 OK); ESI 0.75% x 17,884 = 134.1 (sheet 134 OK); PT gross > 10,000 -> 200 (sheet 200 OK).

### 5.2 VFL1066 Ramnath Babasaheb Gadekar (PF wage below 15,000)

Engine (w = 4, FIXED_GROSS = 327,576/12 = 27,298): gross = 27,298 x 4/30 = 3,639.7 -> 3,640. PF wage = 1,456 + 218 + 218 + 218 = 2,110 -> PF = 12% x 2,110 = **253.20**. ESI: 27,298 > 21,000 -> **0**. PT: 3,640 <= 7,500 -> **0**. Net 3,386.80. Arithmetic is right for the inputs; inputs are wrong per U1 (sheet fixed gross is 24,200).

Archived: PF wage = 58% x 24,200 = 14,036 (< 15,000) -> 12% = 1,684.32 (sheet 1,684.32 OK); ESI 0; PT 200 OK.

### 5.3 VFL1386 Fazal Ilahi Khan (PF wage above 15,000; cap)

Engine (w = 6, FIXED_GROSS = 1,900,008/12 = 158,334): gross = 158,334 x 6/30 = 31,666.8 -> 31,667. PF wage = 12,667 + 1,900 + 1,900 + 1,900 = 18,367 (> 15,000) -> PF = **1,800** (cap). ESI **0**. PT: 31,667 > 10,000 -> **200**. Net 29,667.

Archived: gross 148,706, Basic 59,482 -> PF 1,800 (cap), ESI 0, PT 200: all consistent with the same rules.

No staff on both sides has an engine ESI that matches the sheet (the sheet's ESI population is lost via U1), so the ESI check was done on VFL5237 only, and archived ESI for ESI-eligible staff was verified arithmetically (e.g. VFL1450: 0.75% x 19,720 = 147.9 -> 148).

## 6. Verdict on the engine math

- **Calculation functions are sound.** Workers: Basic, HRA etc., PF, PT and OT reproduce the sheet to within about 0.2% when given the same days (differences are the agreed VDA-for-OT change). The staff formulas (component %, PF 58%-of-gross wage rule with 1,800 cap, ESI 0.75% under 21k, PT slab, OT x2 on Basic) are internally correct and match the sheet when the correct fixed gross is supplied.
- **The September mismatch is mostly inputs, not math:** (a) app attendance/OT capture only from ~24-26 Sep, (b) no efficiency feed, (c) VDA basis, (d) departed employees, (e) consultants with no master. These explain every >Rs 500 gap at the top level.
- **But the feed mapping has real defects that would give wrong October pay too, independent of test-period data:** U1 (staff FIXED_GROSS from `ctc_annual/12`; 6 new hires held, ESI population dropped), U3 (gender code mismatch -> women PT exemption never applies), U4 (PT-exempt list unwired), plus U2 (30 vs 31 day basis), U5 (prod allowance proration policy), U6 (master vs sheet differences for 5 staff) and U7 (VFL5464 has no structure row).
- **Recommendation:** do not advance any run past `calculated` until U1 and U3/U4 are fixed in `lib/payroll/feedSync.ts` (source, then re-vendor), and U2/U5/U6/U7 are decided by Yash/HR. This test did not edit `engine.ts` or any existing repo file.
