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
