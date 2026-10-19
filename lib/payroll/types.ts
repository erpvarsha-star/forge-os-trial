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
  workingDays: number;    // wd: staff/consultants = calendar days; workers = days excl. Sundays
  masters?: SalaryMasters;        // STAFF / PERMANENT_WORKER
  rateProfile?: RateProfile;      // CONSULTANT / PUNE_STAFF
  days: DayCounts;
  otHours: number;
  efficiencyPct?: number | null;  // workers; null/undefined => WARN + slab 0
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
  /** Worker OT rate VDA basis:
   *  'CURRENT_RATE'    -> VDA = 103 x wd  (new HR OS code behaviour; default)
   *  'MASTER_SNAPSHOT' -> VDA = master VDA frozen in old sheets (2,790 for Sep-2026)
   */
  workerOtVdaBasis: 'CURRENT_RATE' | 'MASTER_SNAPSHOT';
  workerVdaRatePerDay: number;   // 103
  workerMasterVdaSnapshot?: number; // used only in MASTER_SNAPSHOT mode
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
