/** Worker OT basis, engine config and extra-earnings tests — synthetic numbers only.
 *  Run: npx tsx scripts/payroll-extras.test.ts */
import { calculateOne, DEFAULT_ENGINE_CONFIG } from '../lib/payroll/engine';
import type { PayrollInput } from '../lib/payroll/types';
import type { SalaryRow } from '../lib/payroll/feedSync';
import { buildEngineConfig, deriveWorkerVdaMaster } from '../lib/payroll/engineConfig';
import { calculateWithExtras, computeExtras, recurringApplies, ExtrasFeeds } from '../lib/payroll/extraEarnings';
import { buildSlipView } from '../lib/payslipLayout';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ok  ${n}`)) : (fail++, console.log(`FAIL  ${n} ${d}`)); };
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

const sal = (id: string, o: Partial<SalaryRow> = {}): SalaryRow => ({ employee_id: id, effective_from: '2026-04-01', is_active: true, effective_to: null,
  basic: null, hra: null, conveyance: null, washing: null, education: null, heat_allow: null, vda: null, production_allow: null,
  medical: null, professional_development: null, communication: null, uniform: null, ctc_annual: null, ...o });

// ---- (B) worker OT = 2 x (basic + flat VDA master) / wd / 8
const worker: PayrollInput = {
  empCode: 'W', category: 'PERMANENT_WORKER', month: 10, year: 2026, workingDays: 26,
  masters: { BASIC: 15756, HRA: 0, CONVEYANCE: 0, WASHING: 0, EDUCATION: 0, HEAT: 0 },
  days: { present: 26, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 }, otHours: 1, efficiencyPct: 80,
  deductions: { canteen: 0, society: 0, advance: 0 },
};
{
  const cfg = { ...DEFAULT_ENGINE_CONFIG, workerOtVdaBasis: 'MASTER_SNAPSHOT' as const, workerMasterVdaSnapshot: 2790 };
  const r = calculateOne(worker, cfg);
  check('worker OT/hr = 178.3269 (basic 15756, master 2790, wd 26) -> 1h pays 178.33', near(r.otPay, 178.33), `got ${r.otPay}`);
  check('VDA earnings stay rate x present days (103 x 26 = 2678)', r.earnings.VDA === 2678, `got ${r.earnings.VDA}`);
  const r2h = calculateOne({ ...worker, otHours: 2 }, cfg);
  check('2 hours = 356.65', near(r2h.otPay, 356.65), `got ${r2h.otPay}`);
  const cur = calculateOne(worker, DEFAULT_ENGINE_CONFIG);
  check('CURRENT_RATE basis differs (sanity)', !near(cur.otPay, r.otPay));
}
// buildEngineConfig / deriveWorkerVdaMaster
{
  const salaries = [sal('a', { vda: 2790 }), sal('b', { vda: 2790 }), sal('c', { vda: 2790 })];
  const b = buildEngineConfig({ vdaPerDay: 110, workerEmployeeIds: ['a', 'b', 'c'], salaries, asOf: '2026-10-31' });
  check('config: MASTER_SNAPSHOT + master 2790', b.cfg.workerOtVdaBasis === 'MASTER_SNAPSHOT' && b.cfg.workerMasterVdaSnapshot === 2790);
  check('config: monthly VDA rate applied', b.cfg.workerVdaRatePerDay === 110);
  check('config: uniform -> no warnings', b.warnings.length === 0);
  const nu = buildEngineConfig({ vdaPerDay: null, workerEmployeeIds: ['a', 'b', 'c'], salaries: [sal('a', { vda: 2790 }), sal('b', { vda: 2790 }), sal('c', { vda: 3000 })], asOf: '2026-10-31' });
  check('config: not uniform -> most common + warning', nu.cfg.workerMasterVdaSnapshot === 2790 && nu.warnings.some((w) => w.startsWith('WORKER_VDA_MASTER_NOT_UNIFORM')), JSON.stringify(nu));
  check('config: null vdaPerDay keeps default 103', nu.cfg.workerVdaRatePerDay === 103);
  const none = buildEngineConfig({ vdaPerDay: 103, workerEmployeeIds: ['a'], salaries: [sal('a', { vda: null })], asOf: '2026-10-31' });
  check('config: none found -> default basis + warning', none.cfg.workerOtVdaBasis === 'CURRENT_RATE' && none.warnings.length === 1);
  const win = deriveWorkerVdaMaster(['a'], [sal('a', { vda: 1000, effective_to: '2026-08-31', is_active: false }), sal('a', { vda: 2790, effective_from: '2026-09-01' })], '2026-10-31');
  check('derive honours validity window (new row)', win.value === 2790);
  check('DEFAULT_ENGINE_CONFIG not mutated', DEFAULT_ENGINE_CONFIG.workerOtVdaBasis === 'CURRENT_RATE');
}

// ---- (C) extras
const PS = '2026-10-01', PE = '2026-10-31';
const rec = (o: Record<string, unknown> = {}) => ({ employee_id: 'e1', kind: 'earning', label: 'Site allowance', amount: 1500, active_from: '2026-01-01', active_to: null, is_active: true, ...o }) as any;
{
  check('recurring: active, open-ended applies', recurringApplies(rec(), PS, PE));
  check('recurring: inactive no', !recurringApplies(rec({ is_active: false }), PS, PE));
  check('recurring: starts after month no', !recurringApplies(rec({ active_from: '2026-11-01' }), PS, PE));
  check('recurring: ended before month no', !recurringApplies(rec({ active_to: '2026-09-30' }), PS, PE));
  check('recurring: ends inside month applies in full', recurringApplies(rec({ active_to: '2026-10-05' }), PS, PE));
  check('recurring: starts on last day applies', recurringApplies(rec({ active_from: '2026-10-31' }), PS, PE));
}
const staffIn = (o: Partial<PayrollInput> = {}): PayrollInput => ({
  empCode: 'S', category: 'STAFF', month: 10, year: 2026, workingDays: 31,
  masters: { FIXED_GROSS: 30000 }, days: { present: 31, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 }, otHours: 0,
  deductions: { canteen: 0, society: 0, advance: 0 }, gender: 'M', ...o });
const noFeeds: ExtrasFeeds = { recurring: [], attendance: [], salaries: [] };
const ctx = (feeds: ExtrasFeeds) => ({ periodStart: PS, periodEnd: PE, feeds });
{
  const base = calculateOne(staffIn());
  const none = calculateWithExtras(staffIn(), 'e1', ctx(noFeeds), DEFAULT_ENGINE_CONFIG);
  check('no extras: identical to engine', JSON.stringify(none.result) === JSON.stringify(base));

  const feeds: ExtrasFeeds = { recurring: [rec(), rec({ label: 'Second', amount: 500 }), rec({ kind: 'deduction', label: 'Penalty', amount: 700 })], attendance: [], salaries: [] };
  const a = calculateWithExtras(staffIn({ deductions: { canteen: 0, society: 0, advance: 0, other: 100 } }), 'e1', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  const baseOther = calculateOne(staffIn({ deductions: { canteen: 0, society: 0, advance: 0, other: 800 } }));
  check('recurring deduction added to deductions.other (100+700)', a.result.deductions.OTHER === 800);
  check('recurring earnings summed under OTHER_ALLOWANCE (2000)', a.result.earnings.OTHER_ALLOWANCE === 2000 && a.extraTotal === 2000);
  check('net = engine net + earnings', near(a.result.netPay!, baseOther.netPay! + 2000), `${a.result.netPay} vs ${baseOther.netPay}`);
  check('totalEarnings includes extras', near(a.result.totalEarnings, baseOther.totalEarnings + 2000));
  check('items list keeps labels', a.items.length === 2 && a.items[0].label === 'Site allowance');
  const b = calculateWithExtras(staffIn({ deductions: { canteen: 0, society: 0, advance: 0, other: 100 } }), 'e1', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('idempotent: calculating twice gives the same result', JSON.stringify(a.result) === JSON.stringify(b.result));
  const inp = staffIn(); const before = JSON.stringify(inp);
  calculateWithExtras(inp, 'e1', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('input not mutated', JSON.stringify(inp) === before);

  // held gets no extras (no masters -> MISSING_MASTERS)
  const h = calculateWithExtras(staffIn({ masters: undefined }), 'e1', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('held employee gets no extras', h.result.held && h.items.length === 0 && h.extraTotal === 0 && h.result.netPay === null);
  // other employee's rows ignored
  const o = calculateWithExtras(staffIn(), 'other', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('other employee rows ignored', o.items.length === 0);
}
// PUNE_STAFF
{
  const pune = (o: Partial<PayrollInput> = {}): PayrollInput => ({
    empCode: 'BUNG99', category: 'PUNE_STAFF', month: 10, year: 2026, workingDays: 31,
    rateProfile: { basis: 'MONTHLY_GROSS_PRORATED', monthlyGross: 24800 },
    days: { present: 31, ph: 0, el: 0, cl: 0, sl: 0, plo: 0, weekOff: 0 }, otHours: 5,
    deductions: { canteen: 0, society: 0, advance: 0 }, ...o });
  const att = [
    { employee_id: 'p', date: '2026-10-03', ot_hours: 2, outstation_travel: true },
    { employee_id: 'p', date: '2026-10-04', ot_hours: 1.5, outstation_travel: false },
    { employee_id: 'p', date: '2026-10-09', ot_hours: 0, outstation_travel: true },
    { employee_id: 'p', date: '2026-09-30', ot_hours: 9, outstation_travel: true },   // outside month
    { employee_id: 'q', date: '2026-10-03', ot_hours: 9, outstation_travel: true },   // other employee
  ];
  const feeds: ExtrasFeeds = { recurring: [], attendance: att, salaries: [sal('p', { ot_rate: 100 })] };
  const base = calculateOne(pune({ otHours: 0 }));
  const r = calculateWithExtras(pune(), 'p', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('PUNE: engine OT not paid (otHours forced 0)', r.result.earnings.OT === 0);
  check('PUNE: BUNG_OT = 3.5h x 100 flat = 350', r.result.earnings.BUNG_OT === 350, JSON.stringify(r.result.earnings));
  check('PUNE: outstation travel = 2 days x 250 = 500', r.result.earnings.OUTSTATION_TRAVEL === 500);
  check('PUNE: net = base net + 850', near(r.result.netPay!, base.netPay! + 850));
  check('PUNE: totalEarnings includes both', near(r.result.totalEarnings, base.totalEarnings + 850));
  check('PUNE: outstation label', r.items.find((i) => i.key === 'OUTSTATION_TRAVEL')?.label === 'Outstation travel');
  // no ot_rate
  const nr = calculateWithExtras(pune(), 'p', ctx({ ...feeds, salaries: [sal('p')] }), DEFAULT_ENGINE_CONFIG);
  check('PUNE: ot hours but no ot_rate -> warning, OT 0, travel still paid',
    nr.warnings.length === 1 && nr.result.earnings.BUNG_OT === undefined && nr.result.earnings.OUTSTATION_TRAVEL === 500, JSON.stringify(nr));
  // non-PUNE never gets BUNG lines, engine OT kept
  const st = computeExtras({ employeeId: 'p', empCode: 'S', category: 'STAFF', periodStart: PS, periodEnd: PE, feeds });
  check('non-PUNE: no BUNG OT / travel', st.items.length === 0 && st.warnings.length === 0);
  const stOt = calculateWithExtras(staffIn({ otHours: 3 }), 'p', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('STAFF keeps engine OT', stOt.result.earnings.OT > 0);
  // top-up / determinism
  const r2 = calculateWithExtras(pune(), 'p', ctx(feeds), DEFAULT_ENGINE_CONFIG);
  check('PUNE idempotent', JSON.stringify(r.result) === JSON.stringify(r2.result));

  // payslip: printed lines sum to totalEarnings, balanced with net
  const rec2 = (cat: string, res: typeof r.result) => ({ id: 'x', employee_id: 'p', month: '10', year: 2026, net_pay: res.netPay,
    earnings_lines: res.earnings, deduction_lines: res.deductions, category: cat }) as any;
  const v = buildSlipView(rec2('PUNE_STAFF', r.result), { name: 'T', empCode: 'X' });
  check('payslip PUNE: prints Overtime + Outstation travel rows', v.earnings.some((x) => x.key === 'BUNG_OT' && x.label.en === 'Overtime') && v.earnings.some((x) => x.key === 'OUTSTATION_TRAVEL'));
  check('payslip PUNE: gross = totalEarnings, no adjustment', near(v.totalEarnings, r.result.totalEarnings) && v.adjustment === 0, `${v.totalEarnings} ${r.result.totalEarnings} ${v.adjustment}`);
  for (const cat of ['STAFF', 'CONSULTANT'] as const) {
    const withAllow = calculateWithExtras(cat === 'STAFF' ? staffIn() : { ...pune(), category: 'CONSULTANT', empCode: 'CON99', otHours: 0 }, 'e1',
      ctx({ recurring: [rec()], attendance: [], salaries: [] }), DEFAULT_ENGINE_CONFIG);
    const sv = buildSlipView(rec2(cat, withAllow.result), { name: 'T', empCode: 'X' });
    check(`payslip ${cat}: Other Allowance printed, balanced`, sv.earnings.some((x) => x.key === 'OTHER_ALLOWANCE') && sv.adjustment === 0 && near(sv.totalEarnings, withAllow.result.totalEarnings));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
