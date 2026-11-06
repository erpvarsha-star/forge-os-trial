/**
 * September 2026 payroll regression suite.
 * Fixtures are the ACTUAL payouts from the legacy HR OS sheets (19 permanent
 * workers + 7 consultants). Run: npx tsx scripts/payroll-engine.sept2026.test.ts
 *
 * MASTER_SNAPSHOT mode reproduces the legacy paid nets (<= Rs 2 tolerance for
 * 3 workers where the old sheets rounded each component to whole rupees).
 * CURRENT_RATE mode documents the intentional OT delta (VDA basis 103 x wd).
 */
import { calculateOne, DEFAULT_ENGINE_CONFIG } from '../lib/payroll/engine';
import { EngineConfig, PayrollInput, ptAmount } from '../lib/payroll/types';
import { finalizeShiftAndOvertime, MIN_WORKING_HOURS } from '../lib/workingHours';

const SNAPSHOT: EngineConfig = {
  ...DEFAULT_ENGINE_CONFIG, workerOtVdaBasis: 'MASTER_SNAPSHOT', workerMasterVdaSnapshot: 2790,
  // Historical reproduction only (actual Sept 2026 payouts used calendar-days proration,
  // not the 26-day fixed basis the owner decided 4 Nov 2026 for live runs).
  monthlyConsultantDayBasis: 'CALENDAR_DAYS_PRORATED',
};

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail}`); }
}
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

interface WFix { emp: string; masters: Record<string, number>; wd: number; present: number; worked: number; pp: number; ot: number; canteen: number; society: number; advance: number; paidNet: number; paidOT: number; }
const WORKERS: WFix[] = [{"emp": "VFL4008", "masters": {"BASIC": 15756.0, "HRA": 3555.84, "CONVEYANCE": 3334.0, "WASHING": 3111.0, "EDUCATION": 3334.0, "HEAT": 0.0, "FIXED_GROSS": 40380.84}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 71.0, "canteen": 15.0, "society": 4788.0, "advance": 0, "paidNet": 41851.0, "paidOT": 12661.21}, {"emp": "VFL4011", "masters": {"BASIC": 15756.0, "HRA": 3560.0, "CONVEYANCE": 3338.0, "WASHING": 3115.0, "EDUCATION": 3338.0, "HEAT": 150.0, "FIXED_GROSS": 40547.0}, "wd": 26.0, "present": 24.0, "worked": 26.0, "pp": 24.0, "ot": 94.0, "canteen": 0, "society": 100.0, "advance": 0, "paidNet": 50546.0, "paidOT": 16762.73}, {"emp": "VFL4012", "masters": {"BASIC": 15756.0, "HRA": 3555.84, "CONVEYANCE": 3334.0, "WASHING": 3111.0, "EDUCATION": 3334.0, "HEAT": 0.0, "FIXED_GROSS": 40380.84}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 47.0, "canteen": 0, "society": 100.0, "advance": 0, "paidNet": 42274.0, "paidOT": 8381.37}, {"emp": "VFL4024", "masters": {"BASIC": 15756.0, "HRA": 3554.56, "CONVEYANCE": 3332.0, "WASHING": 3110.0, "EDUCATION": 3332.0, "HEAT": 150.0, "FIXED_GROSS": 40524.56}, "wd": 26.0, "present": 21.0, "worked": 21.0, "pp": 21.0, "ot": 77.5, "canteen": 0, "society": 6643.0, "advance": 0, "paidNet": 34600.0, "paidOT": 13820.34}, {"emp": "VFL4025", "masters": {"BASIC": 15756.0, "HRA": 3558.4, "CONVEYANCE": 3336.0, "WASHING": 3114.0, "EDUCATION": 3336.0, "HEAT": 150.0, "FIXED_GROSS": 40540.4}, "wd": 26.0, "present": 26.0, "worked": 26.0, "pp": 26.0, "ot": 84.0, "canteen": 0, "society": 100.0, "advance": 0, "paidNet": 49307.0, "paidOT": 14979.46}, {"emp": "VFL4026", "masters": {"BASIC": 15756.0, "HRA": 3557.12, "CONVEYANCE": 3335.0, "WASHING": 3112.0, "EDUCATION": 3335.0, "HEAT": 150.0, "FIXED_GROSS": 40535.119999999995}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 105.0, "canteen": 0, "society": 100.0, "advance": 0, "paidNet": 52771.0, "paidOT": 18724.33}, {"emp": "VFL4032", "masters": {"BASIC": 15756.0, "HRA": 3558.7200000000003, "CONVEYANCE": 3336.0, "WASHING": 3114.0, "EDUCATION": 3336.0, "HEAT": 0.0, "FIXED_GROSS": 40390.72}, "wd": 26.0, "present": 26.0, "worked": 26.0, "pp": 26.0, "ot": 7.0, "canteen": 75.0, "society": 100.0, "advance": 0, "paidNet": 35352.0, "paidOT": 1248.29}, {"emp": "VFL4033", "masters": {"BASIC": 15756.0, "HRA": 3557.12, "CONVEYANCE": 3335.0, "WASHING": 3112.0, "EDUCATION": 3335.0, "HEAT": 150.0, "FIXED_GROSS": 40535.119999999995}, "wd": 26.0, "present": 10.0, "worked": 11.0, "pp": 10.0, "ot": 39.0, "canteen": 0, "society": 5948.0, "advance": 0, "paidNet": 15018.0, "paidOT": 6954.75}, {"emp": "VFL4036", "masters": {"BASIC": 15756.0, "HRA": 3555.84, "CONVEYANCE": 3334.0, "WASHING": 3111.0, "EDUCATION": 3334.0, "HEAT": 150.0, "FIXED_GROSS": 40530.84}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 91.5, "canteen": 0, "society": 0, "advance": 0, "paidNet": 50460.0, "paidOT": 16316.91}, {"emp": "VFL4041", "masters": {"BASIC": 15756.0, "HRA": 3517.28, "CONVEYANCE": 3297.0, "WASHING": 3078.0, "EDUCATION": 3297.0, "HEAT": 150.0, "FIXED_GROSS": 40385.28}, "wd": 26.0, "present": 24.0, "worked": 26.0, "pp": 24.0, "ot": 91.0, "canteen": 0, "society": 5928.0, "advance": 0, "paidNet": 44021.0, "paidOT": 16227.75}, {"emp": "VFL4042", "masters": {"BASIC": 15756.0, "HRA": 3439.2000000000003, "CONVEYANCE": 3224.0, "WASHING": 3009.0, "EDUCATION": 3224.0, "HEAT": 150.0, "FIXED_GROSS": 40092.2}, "wd": 26.0, "present": 26.0, "worked": 26.0, "pp": 26.0, "ot": 103.0, "canteen": 0, "society": 4788.0, "advance": 0, "paidNet": 47560.0, "paidOT": 18367.67}, {"emp": "VFL4043", "masters": {"BASIC": 15756.0, "HRA": 3428.48, "CONVEYANCE": 3214.0, "WASHING": 3000.0, "EDUCATION": 3214.0, "HEAT": 0.0, "FIXED_GROSS": 39902.479999999996}, "wd": 26.0, "present": 21.0, "worked": 26.0, "pp": 21.0, "ot": 25.5, "canteen": 1255.0, "society": 5808.0, "advance": 0, "paidNet": 29894.0, "paidOT": 4547.34}, {"emp": "VFL4045", "masters": {"BASIC": 15756.0, "HRA": 3385.12, "CONVEYANCE": 3174.0, "WASHING": 2962.0, "EDUCATION": 3174.0, "HEAT": 150.0, "FIXED_GROSS": 39891.119999999995}, "wd": 26.0, "present": 24.0, "worked": 26.0, "pp": 24.0, "ot": 92.5, "canteen": 0, "society": 6553.0, "advance": 0, "paidNet": 43169.0, "paidOT": 16495.24}, {"emp": "VFL4063", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 0.0, "FIXED_GROSS": 38926.0}, "wd": 26.0, "present": 24.0, "worked": 26.0, "pp": 24.0, "ot": 96.0, "canteen": 1210.0, "society": 2160.0, "advance": 0, "paidNet": 46211.0, "paidOT": 17119.38}, {"emp": "VFL4065", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 150.0, "FIXED_GROSS": 39076.0}, "wd": 26.0, "present": 23.0, "worked": 26.0, "pp": 23.0, "ot": 90.0, "canteen": 0, "society": 6533.0, "advance": 0, "paidNet": 41652.0, "paidOT": 16049.42}, {"emp": "VFL4066", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 150.0, "FIXED_GROSS": 39076.0}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 8.0, "canteen": 215.0, "society": 0, "advance": 0, "paidNet": 33900.0, "paidOT": 1426.62}, {"emp": "VFL4068", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 150.0, "FIXED_GROSS": 39076.0}, "wd": 26.0, "present": 24.0, "worked": 26.0, "pp": 24.0, "ot": 84.0, "canteen": 0, "society": 645.0, "advance": 0, "paidNet": 46746.0, "paidOT": 14979.46}, {"emp": "VFL4071", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 150.0, "FIXED_GROSS": 39076.0}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 4.5, "canteen": 145.0, "society": 4140.0, "advance": 0, "paidNet": 29205.0, "paidOT": 802.47}, {"emp": "VFL4072", "masters": {"BASIC": 15756.0, "HRA": 3168.0, "CONVEYANCE": 2970.0, "WASHING": 2772.0, "EDUCATION": 2970.0, "HEAT": 150.0, "FIXED_GROSS": 39076.0}, "wd": 26.0, "present": 25.0, "worked": 26.0, "pp": 25.0, "ot": 3.5, "canteen": 360.0, "society": 6613.0, "advance": 0, "paidNet": 26339.0, "paidOT": 624.14}];
interface CFix { emp: string; basis: 'DAILY_RATE' | 'MONTHLY_GROSS_PRORATED'; rateAmount: number | null; monthlyGross: number | null; wd: number; worked: number; ot: number; paidGross: number; paidOT: number; }
const CONSULTANTS: CFix[] = [{"emp": "CON01", "basis": "DAILY_RATE", "rateAmount": 700.0, "monthlyGross": 0.0, "wd": 31.0, "worked": 26.0, "ot": 99.0, "paidGross": 18200.0, "paidOT": 8662.5}, {"emp": "CON05", "basis": "MONTHLY_GROSS_PRORATED", "rateAmount": 20000.0, "monthlyGross": 20000.0, "wd": 31.0, "worked": 21.5, "ot": 0, "paidGross": 13870.967741935483, "paidOT": 0.0}, {"emp": "CON09", "basis": "MONTHLY_GROSS_PRORATED", "rateAmount": 23000.0, "monthlyGross": 23000.0, "wd": 31.0, "worked": 26.0, "ot": 0, "paidGross": 19290.32258064516, "paidOT": 0.0}, {"emp": "CON12", "basis": "MONTHLY_GROSS_PRORATED", "rateAmount": 48000.0, "monthlyGross": 48000.0, "wd": 31.0, "worked": 31.0, "ot": 0, "paidGross": 48000.0, "paidOT": 0.0}, {"emp": "CON13", "basis": "MONTHLY_GROSS_PRORATED", "rateAmount": 55000.0, "monthlyGross": 55000.0, "wd": 31.0, "worked": 31.0, "ot": 0, "paidGross": 55000.0, "paidOT": 0.0}, {"emp": "CON20", "basis": "DAILY_RATE", "rateAmount": 762.0, "monthlyGross": 0.0, "wd": 31.0, "worked": 24.0, "ot": 51.0, "paidGross": 18288.0, "paidOT": 4857.75}, {"emp": "CON24", "basis": "MONTHLY_GROSS_PRORATED", "rateAmount": null, "monthlyGross": 15000.0, "wd": 31.0, "worked": 24.0, "ot": 3.0, "paidGross": 12000.0, "paidOT": 187.5}];

const PT_EXEMPT = new Set(['VFL4021', 'VFL4014', 'VFL4063']);

console.log('== PERMANENT_WORKER x19 (MASTER_SNAPSHOT vs actual paid Sep-2026) ==');
for (const f of WORKERS) {
  const input: PayrollInput = {
    empCode: f.emp, category: 'PERMANENT_WORKER', month: 9, year: 2026,
    workingDays: f.wd, masters: f.masters,
    days: { present: f.present, ph: f.worked - f.present, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: f.ot, efficiencyPct: 81,
    deductions: { canteen: f.canteen, society: f.society, advance: f.advance },
    ptExempt: PT_EXEMPT.has(f.emp),
  };
  const r = calculateOne(input, SNAPSHOT);
  check(`${f.emp} net`, r.netPay !== null && close(r.netPay, f.paidNet, 2), `got ${r.netPay} want ${f.paidNet}`);
  check(`${f.emp} ot`, close(r.otPay, f.paidOT, 0.02), `got ${r.otPay} want ${f.paidOT}`);
}

console.log('== CONSULTANT x7 (gross + OT, no statutory) ==');
for (const f of CONSULTANTS) {
  const input: PayrollInput = {
    empCode: f.emp, category: 'CONSULTANT', month: 9, year: 2026,
    workingDays: f.wd,
    rateProfile: { basis: f.basis, rateAmount: f.rateAmount ?? undefined, monthlyGross: f.monthlyGross ?? undefined },
    days: { present: f.worked, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: f.ot, deductions: { canteen: 0, society: 0, advance: 0 },
  };
  const r = calculateOne(input, SNAPSHOT);
  if (f.emp === 'CON24') {
    // Owner decision 31 Oct 2026: monthly consultants are paid OT = gross/days/8 x hours (legacy paid 187.5 daily-rate style).
    const wantOt = Math.round((15000 / 31 / 8) * 3 * 100) / 100;
    check('CON24 paid OT (not held)', !r.held && r.blockers.length === 0 && close(r.otPay, wantOt, 0.005), `got ${r.otPay} want ${wantOt} ${JSON.stringify(r.blockers)}`);
    continue;
  }
  check(`${f.emp} gross`, close(r.earnings.GROSS ?? 0, f.paidGross, 0.02), `got ${r.earnings.GROSS} want ${f.paidGross}`);
  check(`${f.emp} ot`, close(r.otPay, f.paidOT, 0.02), `got ${r.otPay} want ${f.paidOT}`);
}

console.log('== Monthly consultant OT, legacy calendar-days basis (owner decision 31 Oct 2026) ==');
{
  // Pinned to CALENDAR_DAYS_PRORATED: this block tests the 31 Oct 2026 OT-basis decision
  // in isolation, on the legacy denominator it was decided against. Live runs default to
  // FIXED_26_PRESENT_ONLY (owner decision 4 Nov 2026) — see the block below.
  // empCode must be in the OT whitelist (owner decision 4 Nov 2026) for this to exercise
  // the OT-basis formula at all — see the whitelist block further below for the gate itself.
  const legacyCfg: EngineConfig = { ...DEFAULT_ENGINE_CONFIG, monthlyConsultantDayBasis: 'CALENDAR_DAYS_PRORATED' };
  const mk = (ot: number): PayrollInput => ({
    empCode: 'CON01', category: 'CONSULTANT', month: 10, year: 2026, workingDays: 31,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 20000 },
    days: { present: 31, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  const wantOt = Math.round((20000 / 31 / 8) * 10 * 100) / 100;
  const r0 = calculateOne(mk(0), legacyCfg), r10 = calculateOne(mk(10), legacyCfg);
  check('whitelisted monthly consultant 10h OT: no blocker, not held', !r10.held && r10.blockers.length === 0, JSON.stringify(r10.blockers));
  check(`whitelisted monthly consultant 10h OT = ${wantOt}`, r10.otPay === wantOt && r10.earnings.OT === wantOt, `got ${r10.otPay}`);
  check('whitelisted monthly consultant OT added to net', close((r10.netPay ?? 0) - (r0.netPay ?? 0), wantOt, 0.005), `net ${r10.netPay} vs ${r0.netPay}`);
}

console.log('== Consultant OT whitelist (owner decision 4 Nov 2026: ONLY CON01/CON20/CON24) ==');
{
  const mkMonthly = (emp: string, ot: number): PayrollInput => ({
    empCode: emp, category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 24000 },
    days: { present: 30, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  const mkDaily = (emp: string, ot: number): PayrollInput => ({
    empCode: emp, category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'DAILY_RATE', rateAmount: 700 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  // Non-whitelisted monthly consultants (CON05/09/12/13) get NO OT line even with hours.
  for (const emp of ['CON05', 'CON09', 'CON12', 'CON13']) {
    const r = calculateOne(mkMonthly(emp, 20));
    check(`${emp} (not whitelisted, monthly) gets NO OT despite 20h`, r.otPay === 0 && (r.earnings.OT ?? 0) === 0, `got otPay=${r.otPay} earnings.OT=${r.earnings.OT}`);
    check(`${emp} not held/blocked just from the OT gate`, !r.held && r.blockers.length === 0, JSON.stringify(r.blockers));
  }
  // Non-whitelisted daily-rate consultants (CON16/18/21/22/23 etc.) get NO OT line either.
  for (const emp of ['CON16', 'CON18', 'CON21', 'CON22', 'CON23']) {
    const r = calculateOne(mkDaily(emp, 15));
    check(`${emp} (not whitelisted, daily) gets NO OT despite 15h`, r.otPay === 0 && (r.earnings.OT ?? 0) === 0, `got otPay=${r.otPay} earnings.OT=${r.earnings.OT}`);
  }
  // Whitelisted consultants DO get OT, on either basis.
  for (const emp of ['CON01', 'CON20', 'CON24']) {
    const rM = calculateOne(mkMonthly(emp, 20));
    check(`${emp} (whitelisted, monthly) DOES get OT for 20h`, rM.otPay > 0, `got otPay=${rM.otPay}`);
    const rD = calculateOne(mkDaily(emp, 15));
    check(`${emp} (whitelisted, daily) DOES get OT for 15h`, rD.otPay > 0, `got otPay=${rD.otPay}`);
  }
  // A non-consultant category (PUNE_STAFF) must be completely unaffected by the whitelist.
  const rPune: PayrollInput = {
    empCode: 'BUNG99', category: 'PUNE_STAFF', month: 11, year: 2026, workingDays: 27,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 15000 },
    days: { present: 27, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 10, deductions: { canteen: 0, society: 0, advance: 0 },
  };
  const rp = calculateOne(rPune);
  check('PUNE_STAFF (non-consultant) OT unaffected by consultant whitelist', rp.otPay > 0, `got otPay=${rp.otPay}`);
}

console.log('== Monthly consultant 26-day fixed basis (owner decision 4 Nov 2026, LIVE DEFAULT) ==');
{
  // Owner's own example, verbatim: "consultant salaries are based on 26 days. they dont get
  // weekly off. so if salary is 26000 full 26 days attendance = 26000, if i attend 25 days
  // i get 25000 one day salary deducted."
  const mk = (present: number, ot = 0): PayrollInput => ({
    empCode: 'CONTEST26', category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 26000 },
    days: { present, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  const r26 = calculateOne(mk(26)); // DEFAULT_ENGINE_CONFIG (no cfg arg) — live default basis
  check('26000 salary, 26 present days -> gross 26000', r26.earnings.GROSS === 26000, `got ${r26.earnings.GROSS}`);
  check('26000 salary, 26 present days -> net 26000', r26.netPay === 26000, `got ${r26.netPay}`);
  const r25 = calculateOne(mk(25));
  check('26000 salary, 25 present days -> gross 25000', r25.earnings.GROSS === 25000, `got ${r25.earnings.GROSS}`);
  check('26000 salary, 25 present days -> net 25000', r25.netPay === 25000, `got ${r25.netPay}`);
  // weekly-off/leave credit must NOT inflate pay under the fixed-26 basis
  const rWeekOff: PayrollInput = { ...mk(25), days: { present: 25, ph: 0, el: 1, cl: 0, sl: 0, plo: 0, weekOff: 1 } };
  const rwo = calculateOne(rWeekOff);
  check('weekly-off/leave rows ignored under FIXED_26_PRESENT_ONLY', rwo.earnings.GROSS === 25000, `got ${rwo.earnings.GROSS}`);
  // daily-rate consultants are untouched by this change
  const rDaily = calculateOne({
    empCode: 'CONTESTDAILY', category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'DAILY_RATE', rateAmount: 700 },
    days: { present: 25, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('daily-rate consultant unaffected (700 x 25 = 17500)', rDaily.earnings.GROSS === 17500, `got ${rDaily.earnings.GROSS}`);
}

console.log('== Staff OT whitelist (owner decision, Salary_app_correction_points.xlsx "Staff overtime employees list", 47 named emp_codes) ==');
{
  const mkStaff = (emp: string, ot: number): PayrollInput => ({
    empCode: emp, category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 45000 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  // A spread sample of the 47 whitelisted codes gets OT when hours are fed in.
  for (const emp of ['VFL1066', 'VFL1482', 'VFL5322', 'VFL5450', 'VFL5466']) {
    const r = calculateOne(mkStaff(emp, 20));
    check(`${emp} (whitelisted staff) DOES get OT for 20h`, r.otPay > 0 && (r.earnings.OT ?? 0) > 0, `got otPay=${r.otPay}`);
  }
  // A staff employee NOT on the list gets NO OT line despite nonzero OT hours.
  for (const emp of ['VFL1001', 'VFL5440', 'VFL9999']) {
    const r = calculateOne(mkStaff(emp, 20));
    check(`${emp} (not whitelisted staff) gets NO OT despite 20h`, r.otPay === 0 && (r.earnings.OT ?? 0) === 0, `got otPay=${r.otPay} earnings.OT=${r.earnings.OT}`);
    check(`${emp} not held/blocked just from the OT gate`, !r.held && r.blockers.length === 0, JSON.stringify(r.blockers));
  }
  // WORKER/CONSULTANT/PUNE_STAFF OT must be completely unaffected by the staff whitelist
  // (i.e. a non-STAFF emp_code that happens NOT to be in staffOtWhitelist still gets OT).
  const rWorker: PayrollInput = {
    empCode: 'VFL4008', category: 'PERMANENT_WORKER', month: 11, year: 2026, workingDays: 26,
    masters: { BASIC: 15756, HRA: 3555.84, CONVEYANCE: 3334, WASHING: 3111, EDUCATION: 3334, HEAT: 0, FIXED_GROSS: 40380.84 },
    days: { present: 25, ph: 1, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 20, efficiencyPct: 81, deductions: { canteen: 0, society: 0, advance: 0 },
  };
  const rw = calculateOne(rWorker);
  check('PERMANENT_WORKER (not in staffOtWhitelist, irrelevant) OT unaffected', rw.otPay > 0, `got otPay=${rw.otPay}`);
  const rCon: PayrollInput = {
    empCode: 'CON01', category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'DAILY_RATE', rateAmount: 700 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 15, deductions: { canteen: 0, society: 0, advance: 0 },
  };
  const rc = calculateOne(rCon);
  check('CONSULTANT (on consultant whitelist, not staff list) OT unaffected by staff gate', rc.otPay > 0, `got otPay=${rc.otPay}`);
  const rPuneStaff: PayrollInput = {
    empCode: 'BUNG99', category: 'PUNE_STAFF', month: 11, year: 2026, workingDays: 27,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 15000 },
    days: { present: 27, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 10, deductions: { canteen: 0, society: 0, advance: 0 },
  };
  const rps = calculateOne(rPuneStaff);
  check('PUNE_STAFF (category name resembles staff, but not STAFF category) OT unaffected by staff gate', rps.otPay > 0, `got otPay=${rps.otPay}`);
}

console.log('== State machine sanity ==');
import { canTransition, assertTransition } from '../lib/payroll/payRunStateMachine';
check('draft -> calculating', canTransition('draft', 'calculating'));
check('paid -> draft illegal', !canTransition('paid', 'draft'));
try { assertTransition('archived', 'draft'); check('archived -> draft throws', false); }
catch { check('archived -> draft throws', true); }

console.log('== Weekly-off / working days (Waluj=Friday, Pune=Sunday) ==');
import { workingDaysInMonth, WEEKLY_OFF_WEEKDAY } from '../lib/payroll/types';
check('Waluj Oct-2026 wd = 26 (5 Fridays off)', workingDaysInMonth(2026, 10, WEEKLY_OFF_WEEKDAY.WALUJ) === 26);
check('Pune Oct-2026 wd = 27 (4 Sundays off)', workingDaysInMonth(2026, 10, WEEKLY_OFF_WEEKDAY.PUNE) === 27);
check('Waluj Sep-2026 wd = 26 (4 Fridays off)', workingDaysInMonth(2026, 9, WEEKLY_OFF_WEEKDAY.WALUJ) === 26);
check('Monthly-prorated wd = full calendar', workingDaysInMonth(2026, 10, null) === 31);

console.log('== Worker production allowance: slab + Days Payable override (PATCH_125, Salary_app_correction_points.xlsx) ==');
{
  // VFL4008's real October 2026 row from the owner's Efficiency sheet, read directly
  // with openpyxl: Physical Present Days 21, Efficiency Amount Applicable 4500 (slab
  // for 81%), Days Payable 25 (HR-entered, NOT wd=26) -> Payable Efficiency Amount
  // (per the sheet's own column) = 3780.
  const mk = (present: number, extra: Partial<PayrollInput> = {}): PayrollInput => ({
    empCode: 'VFL4008', category: 'PERMANENT_WORKER', month: 10, year: 2026, workingDays: 26,
    masters: { BASIC: 15756, HRA: 3555.84, CONVEYANCE: 3334, WASHING: 3111, EDUCATION: 3334, HEAT: 0, FIXED_GROSS: 40380.84 },
    days: { present, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
    ...extra,
  });

  const withOverride = calculateOne(mk(21, { efficiencyPct: 81, efficiencyAmountOverride: 4500, daysPayableOverride: 25 }));
  check('Oct-2026 worked example (21 present, 81%->4500, Days Payable 25) = 3780',
    withOverride.earnings.PROD_ALLOWANCE === 3780, `got ${withOverride.earnings.PROD_ALLOWANCE}`);

  // No override supplied (e.g. a month with no payroll_efficiency_slabs/entries row yet) ->
  // falls back to the documented default: PROD_SLAB[81]=4500 x present / wd(26), NOT the
  // Oct-specific 25. This is the exact pre-PATCH_125 behaviour, still correct for months
  // (like Sept-2026) where Days Payable happens to equal wd.
  const fallback = calculateOne(mk(21, { efficiencyPct: 81 }));
  check('No override -> falls back to PROD_SLAB x present / workingDays (26), not Oct Days Payable (25)',
    fallback.earnings.PROD_ALLOWANCE === Math.round(4500 * 21 / 26), `got ${fallback.earnings.PROD_ALLOWANCE}`);
  check('Fallback result differs from the override result (proves the override actually changes the denominator)',
    fallback.earnings.PROD_ALLOWANCE !== withOverride.earnings.PROD_ALLOWANCE);

  // Override present but no efficiencyPct at all -> still MISSING, prod=0, unaffected by the new fields.
  const missing = calculateOne(mk(21, { daysPayableOverride: 25 }));
  check('Missing efficiencyPct still warns + prod=0 regardless of daysPayableOverride',
    missing.earnings.PROD_ALLOWANCE === 0 && missing.warnings.some((w) => w.includes('EFFICIENCY_MISSING')));

  // The frozen Sept-2026 fixtures themselves (all 19 workers, full "== PERMANENT_WORKER x19 =="
  // block above — unchanged by this patch, no override fields set there) already prove the
  // no-override path still reproduces real paid nets exactly; this block only isolates the
  // PROD_ALLOWANCE line to show the override vs. fallback denominators diverge as expected.
}

console.log('== NET_NEGATIVE (held=true, netPay=null, blocker NET_NEGATIVE) — audit gap 1 ==');
{
  // STAFF: tiny gross, huge advance deduction forces net below zero.
  const rStaff = calculateOne({
    empCode: 'VFLNEGTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 5000 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 50000 },
  });
  check('STAFF net-negative -> held', rStaff.held === true, `held=${rStaff.held}`);
  check('STAFF net-negative -> netPay null', rStaff.netPay === null, `netPay=${rStaff.netPay}`);
  check('STAFF net-negative -> blockers includes NET_NEGATIVE', rStaff.blockers.includes('NET_NEGATIVE'), JSON.stringify(rStaff.blockers));
  check('STAFF net-negative -> totalEarnings/totalDeductions still populated (not blank)',
    rStaff.totalEarnings > 0 && rStaff.totalDeductions > rStaff.totalEarnings,
    `TE=${rStaff.totalEarnings} TD=${rStaff.totalDeductions}`);

  // A non-negative case must NOT carry the blocker (sanity control for the check above).
  const rStaffOk = calculateOne({
    empCode: 'VFLNEGTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 40000 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('STAFF ordinary case -> not held, no NET_NEGATIVE', !rStaffOk.held && !rStaffOk.blockers.includes('NET_NEGATIVE'), JSON.stringify(rStaffOk.blockers));

  // CONSULTANT (DAILY_RATE) — small gross, large "other" deduction forces net negative too,
  // proving the NET_NEGATIVE check applies uniformly via finish(), not only in calcStaff/calcWorker.
  const rCon = calculateOne({
    empCode: 'CONNEGTEST', category: 'CONSULTANT', month: 11, year: 2026, workingDays: 30,
    rateProfile: { basis: 'DAILY_RATE', rateAmount: 500 },
    days: { present: 10, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0, other: 20000 },
  });
  check('CONSULTANT net-negative -> held, netPay null, NET_NEGATIVE', rCon.held && rCon.netPay === null && rCon.blockers.includes('NET_NEGATIVE'), JSON.stringify(rCon));
}

console.log('== Half-day (HL) attendance flowing through engine day-count — audit gap 2 ==');
{
  // The engine itself is status-agnostic: it only ever sees DayCounts.present as a number.
  // feedSync's statusEffect() maps DB status 'hl'/'half_day' -> present:0.5 BEFORE the engine
  // runs (see scripts/payroll-feedsync.test.ts for that mapping's own coverage). This block
  // confirms a fractional `days.present` (as a half-day would produce) flows correctly
  // through calcStaff/calcWorker's day-count and proration arithmetic.
  const half = calculateOne({
    empCode: 'VFLHALFTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 26000 }, // 1000/day at wd=26
    days: { present: 0.5, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('STAFF: 0.5 present day -> worked = 0.5', half.worked === 0.5, `got ${half.worked}`);
  check('STAFF: 0.5 present day -> gross prorated to half of a full day (500)', half.totalEarnings === 500, `got ${half.totalEarnings}`);

  const full = calculateOne({
    empCode: 'VFLHALFTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 26000 },
    days: { present: 1, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('STAFF: half-day earns exactly half of a full present-day (gross)', close(half.totalEarnings, full.totalEarnings / 2, 0.01),
    `half=${half.totalEarnings} full=${full.totalEarnings}`);

  // Two half-days (e.g. HL on two separate dates, aggregated by feedSync into days.present=1.0)
  // must be indistinguishable from one full present day.
  const twoHalves = calculateOne({
    empCode: 'VFLHALFTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 26000 },
    days: { present: 1.0, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('STAFF: two aggregated half-days (present=1.0) == one full present day', twoHalves.totalEarnings === full.totalEarnings,
    `got ${twoHalves.totalEarnings} want ${full.totalEarnings}`);

  // Same fractional-day arithmetic for PERMANENT_WORKER (VDA is keyed on pp = days.present directly).
  const halfWorker = calculateOne({
    empCode: 'VFL4008', category: 'PERMANENT_WORKER', month: 11, year: 2026, workingDays: 26,
    masters: { BASIC: 15756, HRA: 3555.84, CONVEYANCE: 3334, WASHING: 3111, EDUCATION: 3334, HEAT: 0, FIXED_GROSS: 40380.84 },
    days: { present: 0.5, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, efficiencyPct: 81, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('PERMANENT_WORKER: half-day VDA = half of the per-day VDA rate (103/2 = 51.5)', halfWorker.earnings.VDA === 51.5, `got ${halfWorker.earnings.VDA}`);
  check('PERMANENT_WORKER: half-day -> worked = 0.5', halfWorker.worked === 0.5, `got ${halfWorker.worked}`);
}

console.log('== Overtime boundary conditions (lib/workingHours.ts finalizeShiftAndOvertime) — audit gap 3 ==');
{
  // NOTE: this is the ONLY overtime-from-hours boundary logic that exists in the TypeScript
  // codebase. It is explicitly VISIBILITY ONLY (lib/workingHours.ts's own header comment:
  // "never read by payroll") — it is NOT the same as the owner's 1 Nov 2026 ">8h = overtime"
  // Extras-report rule, which has no TypeScript implementation at all (HR decides each month's
  // extras by hand per CLAUDE.md's "two-report principle" — see the final report for this gap).
  // Tested here because it is real, exported, reachable code with its own exact numeric
  // boundaries (8.5h/9h nominal, 12h reclassification threshold) that had no test at all.
  // Exactly at nominal (8.5h for a rotating shift) -> OT = 0.
  const atNominal = finalizeShiftAndOvertime('Shift 1', MIN_WORKING_HOURS);
  check('Shift 1 at exactly nominal (8.5h) -> overtimeHours = 0, no reclassification',
    atNominal.overtimeHours === 0 && atNominal.reclassifyToShiftName === null, JSON.stringify(atNominal));

  // Just over nominal -> OT starts accruing (0.01h over).
  const justOverNominal = finalizeShiftAndOvertime('Shift 1', MIN_WORKING_HOURS + 0.01);
  check('Shift 1 at nominal+0.01h -> overtimeHours = 0.01, no reclassification',
    close(justOverNominal.overtimeHours, 0.01, 0.001) && justOverNominal.reclassifyToShiftName === null,
    JSON.stringify(justOverNominal));

  // Just under the 12h reclassification threshold -> stays on Shift 1, OT = hours - 8.5.
  const justUnder12 = finalizeShiftAndOvertime('Shift 1', 11.99);
  check('Shift 1 at 11.99h -> stays Shift 1 (no reclassify), OT = 11.99 - 8.5 = 3.49',
    justUnder12.reclassifyToShiftName === null && close(justUnder12.overtimeHours, 3.49, 0.001),
    JSON.stringify(justUnder12));

  // Exactly at the 12h threshold -> reclassifies to the OT shift, OT = hours - 12 = 0.
  const atThreshold = finalizeShiftAndOvertime('Shift 1', 12);
  check('Shift 1 at exactly 12h -> reclassifies to Shift 4, OT = 12 - 12 = 0',
    atThreshold.reclassifyToShiftName === 'Shift 4' && atThreshold.overtimeHours === 0, JSON.stringify(atThreshold));

  // Owner's own worked example: a completed 12h shift = 4h of overtime above the reclassified
  // shift's own 12h nominal — i.e. 16h worked on what was Shift 1 reclassifies to Shift 4 with
  // OT = 16 - 12 = 4.
  const sixteenHours = finalizeShiftAndOvertime('Shift 1', 16);
  check('Shift 1 at 16h -> reclassifies to Shift 4, OT = 16 - 12 = 4',
    sixteenHours.reclassifyToShiftName === 'Shift 4' && sixteenHours.overtimeHours === 4, JSON.stringify(sixteenHours));

  // Night-shift variant (Shift 3 -> Shift 5) uses the identical threshold/math.
  const night = finalizeShiftAndOvertime('Shift 3', 12);
  check('Shift 3 at exactly 12h -> reclassifies to Shift 5, OT = 0',
    night.reclassifyToShiftName === 'Shift 5' && night.overtimeHours === 0, JSON.stringify(night));
  const nightUnder = finalizeShiftAndOvertime('Shift 3', 11.99);
  check('Shift 3 at 11.99h -> no reclassify, OT = 11.99 - 8.5 = 3.49',
    nightUnder.reclassifyToShiftName === null && close(nightUnder.overtimeHours, 3.49, 0.001), JSON.stringify(nightUnder));

  // General shift has a 9h nominal, not 8.5h, and is never reclassified (not in OVERTIME_RECLASSIFY_TARGET).
  const generalAt9 = finalizeShiftAndOvertime('General', 9);
  check('General at exactly 9h nominal -> OT = 0, never reclassified', generalAt9.overtimeHours === 0 && generalAt9.reclassifyToShiftName === null, JSON.stringify(generalAt9));
  const generalAt12 = finalizeShiftAndOvertime('General', 12);
  check('General at 12h -> NOT reclassified (General has no OT-variant target), OT = 12 - 9 = 3',
    generalAt12.reclassifyToShiftName === null && generalAt12.overtimeHours === 3, JSON.stringify(generalAt12));
}

console.log('== Deduction boundaries: PF cap, ESI cutoff, PT slabs — audit gap 6 ==');
{
  // PF cap: pfWage = BASIC+CONVEYANCE+EDUCATION+MEDICAL (0.40+0.06+0.06+0.06 = 0.58 of gross
  // for STAFF). gross=25800 -> pfWage=14964 (<=15000, 12% uncapped); gross=26000 -> pfWage=15080
  // (>15000, capped flat 1800).
  const underCap = calculateOne({
    empCode: 'VFLPFTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 1,
    masters: { FIXED_GROSS: 25800 },
    days: { present: 1, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('PF: pfWage 14964 (<= 15000 ceiling) -> 12% uncapped = 1795.68', underCap.deductions.PF === 1795.68, `got ${underCap.deductions.PF}`);

  const overCap = calculateOne({
    empCode: 'VFLPFTEST', category: 'STAFF', month: 11, year: 2026, workingDays: 1,
    masters: { FIXED_GROSS: 26000 },
    days: { present: 1, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('PF: pfWage 15080 (> 15000 ceiling) -> flat capped 1800', overCap.deductions.PF === 1800, `got ${overCap.deductions.PF}`);

  // ESI: fixed gross exactly at the 21000 ceiling -> included; one rupee above -> excluded.
  const esiAtCeiling = calculateOne({
    empCode: 'VFLESITEST', category: 'STAFF', month: 11, year: 2026, workingDays: 1,
    masters: { FIXED_GROSS: 21000 },
    days: { present: 1, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('ESI: fixed gross exactly 21000 (at ceiling) -> ESI applied (157.5)', esiAtCeiling.deductions.ESI === 157.5, `got ${esiAtCeiling.deductions.ESI}`);

  const esiOverCeiling = calculateOne({
    empCode: 'VFLESITEST', category: 'STAFF', month: 11, year: 2026, workingDays: 1,
    masters: { FIXED_GROSS: 21000.01 },
    days: { present: 1, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: 0, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  check('ESI: fixed gross 21000.01 (just over ceiling) -> ESI = 0 (excluded)', esiOverCeiling.deductions.ESI === 0, `got ${esiOverCeiling.deductions.ESI}`);

  // PT slabs (exported ptAmount()), exact boundaries: <=7500 nil, <=10000 => 175, else 200
  // (300 in February). Tested directly against the exported function, same one the engine calls.
  check('PT: gross exactly 7500 -> 0', ptAmount(7500, 11, DEFAULT_ENGINE_CONFIG) === 0);
  check('PT: gross 7500.01 -> 175', ptAmount(7500.01, 11, DEFAULT_ENGINE_CONFIG) === 175);
  check('PT: gross exactly 10000 -> 175', ptAmount(10000, 11, DEFAULT_ENGINE_CONFIG) === 175);
  check('PT: gross 10000.01 -> 200 (non-February)', ptAmount(10000.01, 11, DEFAULT_ENGINE_CONFIG) === 200);
  check('PT: gross 10000.01 in February -> 300 (ptFebAmount)', ptAmount(10000.01, 2, DEFAULT_ENGINE_CONFIG) === 300);
}

console.log('== Consultant/staff OT whitelist boundary — audit gap 4 (already covered; cross-check) ==');
{
  // The "== Consultant OT whitelist ==" and "== Staff OT whitelist ==" blocks earlier in this
  // file (added when PATCH_124/the 47-code whitelist shipped) already check: a non-whitelisted
  // consultant/staff employee with high hours gets otPay=0, and a whitelisted one is paid OT,
  // for both CONSULTANT rate bases and for STAFF. This block only adds the one boundary those
  // didn't explicitly name: otHours fed in but exactly 0 for a non-whitelisted employee (should
  // also be 0, trivially) vs a whitelisted employee with otHours=0 (should also be 0 — the gate
  // allows OT, but 0 hours still pays 0) — proving the whitelist gate and the hours-based amount
  // are independent checks, not conflated.
  const mkStaff = (emp: string, ot: number): PayrollInput => ({
    empCode: emp, category: 'STAFF', month: 11, year: 2026, workingDays: 26,
    masters: { FIXED_GROSS: 45000 },
    days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 },
    otHours: ot, deductions: { canteen: 0, society: 0, advance: 0 },
  });
  const whitelistedZeroHours = calculateOne(mkStaff('VFL1066', 0));
  check('Whitelisted staff with otHours=0 -> otPay still 0 (gate allows OT, but no hours means no amount)',
    whitelistedZeroHours.otPay === 0, `got ${whitelistedZeroHours.otPay}`);
  const notWhitelistedZeroHours = calculateOne(mkStaff('VFL1001', 0));
  check('Non-whitelisted staff with otHours=0 -> otPay 0 (same result, different reason)',
    notWhitelistedZeroHours.otPay === 0, `got ${notWhitelistedZeroHours.otPay}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
