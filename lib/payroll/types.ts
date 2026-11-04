/**
 * Forge OS — Payroll Engine types
 * Port of HR OS (Google Sheets / Apps Script) payroll calculation contract.
 * Categories, components, statutory rules and feed names mirror the sheet
 * exactly so September 2026 payouts can be reproduced 1:1.
 */

export type PayCategory = 'STAFF' | 'PERMANENT_WORKER' | 'CONSULTANT' | 'PUNE_STAFF';

export type RateBasis = 'DAILY_RATE' | 'MONTHLY_GROSS_PRORATED';

export interface SalaryMasters {
  BASIC?: number;
  HRA?: number;
  CONVEYANCE?: number;
  WASHING?: number;
  EDUCATION?: number;
  HEAT?: number;          // worker heat allowance master (150 => 5.78/day present)
  FIXED_GROSS?: number;   // staff: monthly fixed gross
}

export interface RateProfile {
  basis: RateBasis;
  rateAmount?: number;    // DAILY_RATE: per-day rate
  monthlyGross?: number;  // MONTHLY_GROSS_PRORATED: monthly gross
}

export interface DayCounts {
  present: number;   // physical present days (VDA basis for workers)
  ph: number;        // paid holiday
  el: number; cl: number; sl: number; plo: number;
  weekOff: number;   // counted in w for staff/consultants, EXCLUDED for workers
}

export interface PayrollInput {
  empCode: string;
  category: PayCategory;
  month: number;          // 1-12
  year: number;
  workingDays: number;    // wd: staff/consultants = calendar days; workers = days excl. site weekly-off
  masters?: SalaryMasters;        // STAFF / PERMANENT_WORKER
  rateProfile?: RateProfile;      // CONSULTANT / PUNE_STAFF
  days: DayCounts;
  otHours: number;
  efficiencyPct?: number | null;  // workers; null/undefined => WARN + slab 0
  /** Worker production allowance — OWNER DATA 4 Nov 2026 (Salary_app_correction_points.xlsx,
   *  Efficiency sheet). When the month has an HR-entered slab-table lookup, feedSync resolves
   *  it to a flat amount + denominator and passes both here; the engine then prorates
   *  `efficiencyAmountOverride x present / daysPayableOverride` instead of
   *  `prodSlabFor(efficiencyPct) x present / workingDays`. Either/both undefined => engine
   *  falls back to the PROD_SLAB table + `workingDays`, the documented default used when no
   *  month entry exists yet, and exactly what historical/frozen fixtures already rely on. */
  efficiencyAmountOverride?: number;
  daysPayableOverride?: number;
  deductions: {
    canteen: number;
    society: number;
    advance: number;
    other?: number;
  };
  ptExempt?: boolean;             // explicit PT exemption list (VFL4021/4014/4063)
  gender?: 'M' | 'F';             // women PT-exempt up to 25,000 gross
}

export type Blocker =
  | 'NET_NEGATIVE'
  | 'CONSULTANT_OT'
  | 'MISSING_RATE'
  | 'MISSING_MASTERS'
  | 'DISPATCH_INCENTIVE'
  | 'LEAVE_ENCASHMENT';

export interface PayrollResult {
  empCode: string;
  category: PayCategory;
  worked: number;          // w actually paid
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number | null;   // null when held
  otPay: number;
  employer: { pf: number; bonus: number; gratuity: number };
  blockers: Blocker[];
  warnings: string[];
  held: boolean;
}

export interface EngineConfig {
  /** Worker OT rate VDA basis — DECIDED 20 Oct 2026: use 'CURRENT_RATE'.
   *  'CURRENT_RATE'    -> VDA = 103 x wd  (correct, per current HR OS sheet)
   *  'MASTER_SNAPSHOT' -> VDA = master VDA frozen in old sheets (2,790 for Sep-2026);
   *                       regression-testing only, never for live runs.
   */
  workerOtVdaBasis: 'CURRENT_RATE' | 'MASTER_SNAPSHOT';
  workerVdaRatePerDay: number;   // 103
  workerMasterVdaSnapshot?: number; // used only in MASTER_SNAPSHOT mode
  /** Monthly-rate CONSULTANT day basis — OWNER DECISION 4 Nov 2026:
   *  "consultant salaries are based on 26 days. they dont get weekly off.
   *  so if salary is 26000 full 26 days attendance = 26000, if i attend 25
   *  days i get 25000 one day salary deducted."
   *  'FIXED_26_PRESENT_ONLY' (live default) -> dailyRate = monthlyGross / 26,
   *     pay = dailyRate x days.present (no weekly-off/leave credit).
   *  'CALENDAR_DAYS_PRORATED' -> legacy basis (gross x w / calendar-days-in-month,
   *     w includes weekOff/leave credit) — kept ONLY to reproduce the actual
   *     September 2026 payouts in the regression suite; never use for live runs.
   */
  monthlyConsultantDayBasis: 'FIXED_26_PRESENT_ONLY' | 'CALENDAR_DAYS_PRORATED';
  /** OWNER DECISION 4 Nov 2026 (supersedes the 31 Oct "all monthly consultants
   *  get OT" decision): only these 3 consultants are paid overtime at all —
   *  CON01, CON20, CON24. Every other consultant (monthly: CON05/09/12/13;
   *  daily: CON16/18/21/22/23) gets NO OT line, regardless of rate_type/basis
   *  or hours worked. Gate is a pure emp_code whitelist, checked only for
   *  category === 'CONSULTANT' — never widen this by rate_type or category. */
  consultantOtWhitelist: string[];
  /** STAFF OT WHITELIST — OWNER DECISION (Salary_app_correction_points.xlsx,
   *  "Staff overtime employees list" tab, 47 named emp_codes). Only these 47
   *  STAFF employees are paid overtime; every other STAFF employee gets no OT
   *  line regardless of otHours fed in. Gate is a pure emp_code whitelist,
   *  checked only for category === 'STAFF' — never widen this by department,
   *  role or any other field, and never let it affect WORKER/CONSULTANT/
   *  PUNE_STAFF OT logic. */
  staffOtWhitelist: string[];
  pfCeiling: number;             // 15000
  pfCappedAmount: number;        // 1800
  esiCeiling: number;            // 21000 (fixed gross)
  ptFebAmount: number;           // 300
  ptWomenExemptUpto: number;     // 25000
  mlwfAmount: number;            // 25, in months 6 & 12
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  workerOtVdaBasis: 'CURRENT_RATE',
  workerVdaRatePerDay: 103,
  workerMasterVdaSnapshot: 2790,
  monthlyConsultantDayBasis: 'FIXED_26_PRESENT_ONLY',
  consultantOtWhitelist: ['CON01', 'CON20', 'CON24'],
  staffOtWhitelist: [
    'VFL1066', 'VFL1272', 'VFL1290', 'VFL1327', 'VFL1391', 'VFL1446', 'VFL1450',
    'VFL1453', 'VFL1482', 'VFL1516', 'VFL1520', 'VFL1527', 'VFL1543', 'VFL1549',
    'VFL1556', 'VFL1562', 'VFL5237', 'VFL5272', 'VFL5273', 'VFL5302', 'VFL5303',
    'VFL5318', 'VFL5321', 'VFL5322', 'VFL5324', 'VFL5347', 'VFL5382', 'VFL5397',
    'VFL5399', 'VFL5400', 'VFL5405', 'VFL5409', 'VFL5413', 'VFL5430', 'VFL5433',
    'VFL5439', 'VFL5444', 'VFL5448', 'VFL5449', 'VFL5450', 'VFL5452', 'VFL5458',
    'VFL5459', 'VFL5460', 'VFL5463', 'VFL5465', 'VFL5466',
  ],
  pfCeiling: 15000,
  pfCappedAmount: 1800,
  esiCeiling: 21000,
  ptFebAmount: 300,
  ptWomenExemptUpto: 25000,
  mlwfAmount: 25,
};

/** Staff component percentages of prorated gross (HR OS STAFF_COMPONENT_PCTS). */
export const STAFF_COMPONENT_PCTS: Record<string, number> = {
  BASIC: 0.40, HRA: 0.24, CONVEYANCE: 0.06, MEDICAL: 0.06, EDUCATION: 0.06,
  PRO_DEV: 0.03, COMMUNICATION: 0.02, UNIFORM: 0.04, WASHING: 0.09,
};

/** Worker production-allowance slab by floor(efficiency %). */
export const PROD_SLAB: Record<number, number> = {
  81: 4500, 82: 5000, 83: 6500, 84: 7500, 85: 8500,
};
export const prodSlabFor = (pct: number | null | undefined): number | null => {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const f = Math.floor(pct);
  if (f < 81) return 0;
  return PROD_SLAB[Math.min(f, 85)];
};

/** Maharashtra PT slab on gross (simplified to HR OS ptAmount behaviour). */
export function ptAmount(gross: number, month: number, cfg: EngineConfig): number {
  if (gross <= 7500) return 0;
  if (gross <= 10000) return 175;
  return month === 2 ? cfg.ptFebAmount : 200;
}

/**
 * Weekly-off weekday per site (JS convention: 0 = Sunday … 6 = Saturday).
 * Waluj plant: FRIDAY is the weekly off. Pune office: SUNDAY is the weekly off.
 * If a Waluj employee is called in for Friday maintenance, that day is entered
 * as PRESENT (it is not a week-off for them) — the attendance feed handles it;
 * the engine just never sees it as an off day.
 */
export const WEEKLY_OFF_WEEKDAY = { WALUJ: 5, PUNE: 0 } as const;
export type Site = keyof typeof WEEKLY_OFF_WEEKDAY;

/** How many times `weekday` occurs in the given calendar month. */
export function countWeekdayInMonth(year: number, month: number, weekday: number): number {
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-12
  let n = 0;
  for (let d = 1; d <= daysInMonth; d++) if (new Date(year, month - 1, d).getDay() === weekday) n++;
  return n;
}

/**
 * Working days (wd) for a month.
 * - PERMANENT_WORKER: calendar days minus the site's weekly-off days
 *   (e.g. Waluj Oct-2026 = 31 - 5 Fridays = 26; Pune = 31 - 4 Sundays = 27).
 * - STAFF / CONSULTANT / PUNE_STAFF on monthly proration: full calendar days
 *   (pass weeklyOffWeekday = null).
 */
export function workingDaysInMonth(year: number, month: number, weeklyOffWeekday: number | null): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return weeklyOffWeekday === null ? daysInMonth : daysInMonth - countWeekdayInMonth(year, month, weeklyOffWeekday);
}
