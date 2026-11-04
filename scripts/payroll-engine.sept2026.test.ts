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
import { EngineConfig, PayrollInput } from '../lib/payroll/types';

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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
