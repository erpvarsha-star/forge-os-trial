/**
 * September 2026 re-run: STAFF + PERMANENT_WORKER (offline, read-only).
 *
 * Usage: npx tsx scripts/payroll-sim-sep2026-rerun-staffwork.ts <data.json> <salary-variants.json> <afterfix|beforefix> <active|all> <asOfMonth> <out.json>
 *
 * No data lives in the repo. <data.json> has employees[], archive[], sheet.workers[] (see payroll-sim-sep2026.ts)
 * plus config.workerMasterVdaSnapshot and exceptions.<emp_code>.repaid. <salary-variants.json> maps a variant name to salary rows.
 */
import * as fs from 'fs';
import { assemblePayrollInputs } from '../lib/payroll/feedSync';
import { calculateOne } from '../lib/payroll/engine';
import { DEFAULT_ENGINE_CONFIG } from '../lib/payroll/types';
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const V = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const variant = process.argv[4] as 'afterfix' | 'beforefix';
const activeOnly = process.argv[5] === 'active';
const asOfMonth = Number(process.argv[6] ?? 9);
const outPath = process.argv[7];
const r2 = (n: number) => Math.round(n * 100) / 100;
const TOL = 50;
const CFG = { ...DEFAULT_ENGINE_CONFIG, workerOtVdaBasis: 'MASTER_SNAPSHOT' as const, workerMasterVdaSnapshot: D.config.workerMasterVdaSnapshot as number };
const employees = D.employees.map((e: any) => ({ id: e.emp_code, emp_code: e.emp_code, name: e.emp_code, category: e.category, work_location: e.work_location ?? null, gender: e.gender ?? null, is_active: !!e.is_active, weekly_off_day: e.weekly_off_day ?? null, pt_exempt: !!e.pt_exempt }));
let salRows = V[variant].map((s: any) => ({ employee_id: s.emp_code, effective_from: s.effective_from, is_active: !!s.is_active, basic: s.basic, hra: s.hra, conveyance: s.conveyance, washing: s.washing, education: s.education, heat_allow: s.heat_allow, vda: s.vda, production_allow: s.production_allow, medical: s.medical, professional_development: s.professional_development, communication: s.communication, uniform: s.uniform, ctc_annual: s.ctc_annual, rate_type: s.rate_type, daily_rate: s.daily_rate }));
if (activeOnly) salRows = salRows.filter((s: any) => s.is_active);
const zero = () => ({ present: 0, wo: 0, el: 0, cl: 0, sl: 0, ph: 0, ot: 0, canteen: 0, society: 0, advance: 0, otherDed: 0 });
const inj: Record<string, any> = {}; const archive: Record<string, any> = {};
for (const a of D.archive) archive[a.emp_code] = a;
for (const a of D.archive) { if (a.category !== 'STAFF') continue; const d = a.deductions || {}; inj[a.emp_code] = { ...zero(), present: a.worked, ot: a.ot ?? 0, canteen: d.CANTEEN ?? 0, society: d.SOCIETY ?? 0, advance: d.ADVANCE ?? 0, otherDed: d.TDS ?? 0 }; }
for (const w of D.sheet.workers) inj[w.emp_code] = { ...zero(), present: w.present, el: w.el, cl: w.cl, sl: w.sl, ph: w.ph, ot: w.ot, canteen: w.canteen, society: w.society, advance: w.advance };
for (const c of (D.config.onLeaveCodes ?? [])) inj[c] = zero();
const codes = Object.keys(inj);
function feeds(): any {
  const attendance: any[] = [], canteen: any[] = [], society: any[] = [], advances: any[] = [], adjustments: any[] = [];
  const DATE = `2026-${String(asOfMonth).padStart(2, '0')}-15`;
  for (const code of codes) {
    const i = inj[code]; const ot = { v: i.ot };
    const push = (status: string, n: number) => { let left = n; while (left >= 1) { attendance.push({ employee_id: code, date: DATE, status, overtime_hours: ot.v, check_in_time: null, check_out_time: null }); ot.v = 0; left -= 1; } if (left >= 0.5) { attendance.push({ employee_id: code, date: DATE, status: status === 'p' ? 'hl' : status, overtime_hours: ot.v, check_in_time: null, check_out_time: null }); ot.v = 0; } };
    push('p', i.present); push('wo', i.wo); push('el', i.el); push('cl', i.cl); push('sl', i.sl); push('ph', i.ph);
    if (ot.v > 0) attendance.push({ employee_id: code, date: DATE, status: 'a', overtime_hours: ot.v, check_in_time: null, check_out_time: null });
    if (i.canteen) canteen.push({ employee_id: code, amount_inr: i.canteen, approval_status: 'approved' });
    if (i.society) society.push({ employee_id: code, total_recovery_inr: i.society, approval_status: 'approved' });
    if (i.advance) advances.push({ employee_id: code, monthly_deduction: i.advance, outstanding_balance: 1e9, status: 'approved' });
    if (i.otherDed) adjustments.push({ employee_id: code, adjustment_type: 'OTHER', signed_amount_inr: -i.otherDed, approval_status: 'approved' });
  }
  return { employees, salaries: salRows, attendance, punches: [], leaves: [], advances, canteen, society, efficiency: [{ employee_id: null, efficiency_pct: D.config.efficiencyPct ?? 81, approval_status: 'approved' }], adjustments, statusEvents: (D.config.onLeaveCodes ?? []).map((c: string) => ({ employee_id: c, status: 'on_leave', effective_from: '2026-09-01' })) };
}
const asm = assemblePayrollInputs(2026, asOfMonth, feeds());
const inp: Record<string, any> = {}; for (const i of asm.inputs) inp[i.empCode] = i;
const scaled = (i: any) => { const f = i.workingDays / 31, d = i.days; return { ...i, days: { present: d.present * f, ph: d.ph * f, el: d.el * f, cl: d.cl * f, sl: d.sl * f, plo: d.plo * f, weekOff: d.weekOff * f }, otHours: i.otHours * f }; };
const six: string[] = D.config.sixMasters ?? [];
const rows: any[] = [];
const sheetFGcheck = (a: any, inpt: any) => ({ sheetFG: a.te / (a.worked / 31), liveFG: inpt.masters?.FIXED_GROSS });
for (const a of D.archive.filter((x: any) => ['STAFF', 'PERMANENT_WORKER'].includes(x.category))) {
  const code = a.emp_code, i = inp[code]; const pop = a.category;
  const row: any = { code, pop, sheetNet: a.net, basicPicked: i?.masters?.BASIC ?? null };
  if (!i) { row.cls = 'FAIL'; row.note = 'no input'; rows.push(row); continue; }
  const raw = calculateOne(i, CFG);
  if (raw.held) { row.cls = 'FAIL'; row.held = raw.blockers; row.note = 'HELD'; rows.push(row); continue; }
  row.rawNet = raw.netPay; row.dRaw = r2(raw.netPay! - a.net);
  if (pop === 'PERMANENT_WORKER') {
    const cur = calculateOne(i, DEFAULT_ENGINE_CONFIG); row.dCurrentRateBasis = r2(cur.netPay! - a.net);
    row.otPay = raw.earnings.OT; row.otHours = i.otHours; row.vdaEarned = raw.earnings.VDA; row.presentDays = i.days.present; row.wd = i.workingDays;
    row.otRatePerHr = i.otHours ? r2(raw.earnings.OT / i.otHours * 1e4) / 1e4 : null;
    row.cls = Math.abs(row.dRaw) <= TOL ? (Math.abs(row.dRaw) <= 2 ? 'PASS_EXACT' : 'PASS_WITHIN50') : 'FAIL';
    if ((D.config.u5ExceptionCodes ?? []).includes(code)) { row.exception = 'U5 manual exception (owner)'; row.wouldPassWithoutException = Math.abs(row.dRaw) <= TOL; if (row.cls === 'FAIL') row.cls = 'PASS_EXCEPTION'; }
  } else {
    const sc = calculateOne(scaled(i), CFG); row.dScaled = sc.held ? null : r2(sc.netPay! - a.net);
    row.cls = Math.abs(row.dRaw) <= 2 ? 'PASS_EXACT' : Math.abs(row.dRaw) <= TOL ? 'PASS_WITHIN50' : (row.dScaled !== null && Math.abs(row.dScaled) <= TOL ? 'PASS_U2' : 'FAIL');
    if (D.exceptions && D.exceptions[code]) { const REPAID = D.exceptions[code].repaid as number; row.residualAfterRepaid = r2(raw.netPay! - (a.net - REPAID)); row.residualAfterRepaidScaled = row.dScaled === null ? null : r2(sc.netPay! - (a.net - REPAID)); const ok = Math.abs(row.residualAfterRepaid) <= TOL || (row.dScaled !== null && Math.abs(row.residualAfterRepaidScaled) <= TOL); row.cls = ok ? 'PASS_EXCEPTION' : 'FAIL'; row.exception = 'repaid amount (owner): app net lower by that amount'; }
    if (D.config.openCodes && D.config.openCodes.includes(code)) { row.cls = 'OPEN'; row.note = 'recurring Other Allowance unexplained; engine has no positive-earnings input'; }
  }
  rows.push(row);
}
for (const c of (D.config.onLeaveCodes ?? [])) { const i = inp[c]; const r = i ? calculateOne(i, CFG) : null; rows.push({ code: c, pop: 'STAFF', cls: 'NOTE', held: r?.held ? r.blockers : null, rawNet: r?.netPay ?? null, warnings: r?.warnings, daysPresent: i?.days }); }
fs.writeFileSync(outPath, JSON.stringify({ variant, activeOnly, asOfMonth, rows, warnings: asm.warnings.filter((w: string) => new RegExp('^(' + [...six, ...(D.config.onLeaveCodes ?? [])].join('|') + ')').test(w)), blocked: asm.blockedEmployees }, null, 1));
const cnt: Record<string, number> = {}; for (const r of rows) cnt[r.pop + ':' + r.cls] = (cnt[r.pop + ':' + r.cls] || 0) + 1;
console.log(variant, activeOnly ? 'active-only' : 'all-rows', 'month', asOfMonth, JSON.stringify(cnt));
for (const c of six) { const r = rows.find((x) => x.code === c); console.log(' ', c, 'basic', r?.basicPicked, r?.cls, 'dRaw', r?.dRaw, 'dScaled', r?.dScaled, r?.held ?? ''); }
