/**
 * September 2026 payroll GATE simulation (offline, read-only).
 *
 * Usage:  npx tsx scripts/payroll-sim-sep2026.ts <data.json> [detail-out.json]
 *
 * No data lives in the repo. <data.json> is produced from SELECT-only queries
 * (see scripts/payroll-sim-sep2026.sql) plus the September Google Sheets tabs and
 * has this shape:
 *   employees: [{emp_code, category, gender, is_active, weekly_off_day, work_location, pt_exempt}]
 *   salaries:  [{emp_code, effective_from, is_active, basic, hra, ... ctc_annual, rate_type, daily_rate}]
 *   archive:   [{emp_code, category, net, worked, ot, basic?, vda?, deductions:{PF,PT,CANTEEN,SOCIETY,ADVANCE,TDS,PROD_OFFSET,...}}]
 *   sheet:     { workers:[...], consultants:[...], pune:[...] }   (day counts + feeds read from the Drive tabs)
 *
 * Method: build every PayrollInput with the vendored assemblePayrollInputs()
 * (live masters + live employee flags, category routing by emp_code), inject the
 * SAME day counts / OT / feeds as the September sheet as synthetic attendance rows and
 * feed rows, then calculateOne() with DEFAULT_ENGINE_CONFIG and compare NET with the sheet.
 *
 * U2 proof: for STAFF and monthly-rate CONSULTANT/PUNE_STAFF the sheet divides by 31 in a
 * 30-day month. A second ("scaled") run multiplies days and OT hours by wd/31; a person who
 * only fails the raw run and clears the 2 rupee bar when scaled is "explained by frozen rule U2".
 */
import * as fs from 'fs';
import { assemblePayrollInputs, FeedBundle, EmployeeRow, SalaryRow, AttendanceRow } from '../lib/payroll/feedSync';
import { calculateOne } from '../lib/payroll/engine';
import { DEFAULT_ENGINE_CONFIG, PayrollInput, PayrollResult } from '../lib/payroll/types';

const YEAR = 2026, MONTH = 9, TOL = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Cls = 'EXACT' | 'U2' | 'U5' | 'U1R' | 'VDAOT' | 'U6' | 'SHEETEXTRA' | 'HELD' | 'UNEXPLAINED';
/** Strict bar (as written by the owner): EXACT (<= 2 rupees), or explained by a FROZEN rule (U2, U5).
 *  U1R / VDAOT / U6 / SHEETEXTRA carry a documented or root-caused explanation but are NOT frozen rules,
 *  so they are reported separately and still fail the strict bar. */
const STRICT_OK: Cls[] = ['EXACT', 'U2', 'U5'];
interface Row {
  code: string; pop: string; cls: Cls; sheetNet: number | null; archNet: number | null;
  rawNet: number | null; scaledNet: number | null; dRaw: number | null; dScaled: number | null;
  held?: string[]; note?: string;
}

const dataPath = process.argv[2];
if (!dataPath) { console.error('usage: tsx scripts/payroll-sim-sep2026.ts <data.json> [detail-out.json]'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// ---- build raw feed rows from the data file ---------------------------------------------
const employees: EmployeeRow[] = D.employees.map((e: any) => ({
  id: e.emp_code, emp_code: e.emp_code, name: e.emp_code, category: e.category,
  work_location: e.work_location ?? null, gender: e.gender ?? null, is_active: !!e.is_active,
  weekly_off_day: e.weekly_off_day ?? null, pt_exempt: !!e.pt_exempt,
}));
const salaries: SalaryRow[] = D.salaries.map((s: any) => ({
  employee_id: s.emp_code, effective_from: s.effective_from, is_active: !!s.is_active,
  basic: s.basic, hra: s.hra, conveyance: s.conveyance, washing: s.washing, education: s.education,
  heat_allow: s.heat_allow, vda: s.vda, production_allow: s.production_allow, medical: s.medical,
  professional_development: s.professional_development, communication: s.communication, uniform: s.uniform,
  ctc_annual: s.ctc_annual, rate_type: s.rate_type ?? null, daily_rate: s.daily_rate ?? null,
}));

interface Inj {
  present: number; wo: number; el: number; cl: number; sl: number; ph: number;
  ot: number; canteen: number; society: number; advance: number; otherDed: number;
}
const inj: Record<string, Inj> = {};
const zero = (): Inj => ({ present: 0, wo: 0, el: 0, cl: 0, sl: 0, ph: 0, ot: 0, canteen: 0, society: 0, advance: 0, otherDed: 0 });

// STAFF: sheet "worked" (weekly offs inside it) -> present; feeds from archived deductions
const archive: Record<string, any> = {};
for (const a of D.archive) archive[a.emp_code] = a;
for (const a of D.archive) {
  if (a.category !== 'STAFF') continue;
  const d = a.deductions || {};
  inj[a.emp_code] = { ...zero(), present: a.worked, ot: a.ot ?? 0, canteen: d.CANTEEN ?? 0, society: d.SOCIETY ?? 0, advance: d.ADVANCE ?? 0, otherDed: d.TDS ?? 0 };
}
const sheetWorkers: Record<string, any> = {};
for (const w of D.sheet.workers) {
  sheetWorkers[w.emp_code] = w;
  inj[w.emp_code] = { ...zero(), present: w.present, el: w.el, cl: w.cl, sl: w.sl, ph: w.ph, ot: w.ot, canteen: w.canteen, society: w.society, advance: w.advance };
}
const sheetCons: Record<string, any> = {};
for (const c of D.sheet.consultants) {
  sheetCons[c.emp_code] = c;
  inj[c.emp_code] = { ...zero(), present: c.present, wo: c.wo, el: c.leave, ot: c.ot };
}
const sheetPune: Record<string, any> = {};
for (const p of D.sheet.pune) {
  sheetPune[p.emp_code] = p;
  // sheet "OT=" notes are free-text Other Allowance, not computed OT (OT Hours/Amount columns are blank): not injected as OT
  inj[p.emp_code] = { ...zero(), present: p.present, wo: p.wo, el: p.ph, ot: p.otHours ?? 0, canteen: p.canteen, society: p.society, advance: p.advance, otherDed: p.otherDed };
}

function feedsFor(codes: string[]): FeedBundle {
  const attendance: AttendanceRow[] = [];
  const canteen: any[] = [], society: any[] = [], advances: any[] = [], adjustments: any[] = [];
  const DATE = `${YEAR}-09-15`;
  const push = (code: string, status: string, n: number, otFirst: { v: number }) => {
    let left = n;
    while (left >= 1) { attendance.push({ employee_id: code, date: DATE, status, overtime_hours: otFirst.v, check_in_time: null, check_out_time: null }); otFirst.v = 0; left -= 1; }
    if (left >= 0.5) { attendance.push({ employee_id: code, date: DATE, status: status === 'p' ? 'hl' : status, overtime_hours: otFirst.v, check_in_time: null, check_out_time: null }); otFirst.v = 0; }
  };
  for (const code of codes) {
    const i = inj[code]; if (!i) continue;
    const ot = { v: i.ot };
    push(code, 'p', i.present, ot); push(code, 'wo', i.wo, ot);
    push(code, 'el', i.el, ot); push(code, 'cl', i.cl, ot); push(code, 'sl', i.sl, ot); push(code, 'ph', i.ph, ot);
    if (ot.v > 0) attendance.push({ employee_id: code, date: DATE, status: 'a', overtime_hours: ot.v, check_in_time: null, check_out_time: null });
    if (i.canteen) canteen.push({ employee_id: code, amount_inr: i.canteen, approval_status: 'approved' });
    if (i.society) society.push({ employee_id: code, total_recovery_inr: i.society, approval_status: 'approved' });
    if (i.advance) advances.push({ employee_id: code, monthly_deduction: i.advance, outstanding_balance: 1e9, status: 'approved' });
    if (i.otherDed) adjustments.push({ employee_id: code, adjustment_type: 'OTHER', signed_amount_inr: -i.otherDed, approval_status: 'approved' });
  }
  return {
    employees, salaries, attendance, punches: [], leaves: [], advances, canteen, society,
    efficiency: [{ employee_id: null, efficiency_pct: 81, approval_status: 'approved' }], // Sept plant efficiency (proved per worker below)
    adjustments, statusEvents: [],
  };
}

const sheetCodes = new Set<string>([...D.archive.map((a: any) => a.emp_code), ...D.sheet.pune.map((p: any) => p.emp_code)]);
const injected = Object.keys(inj);
const assembled = assemblePayrollInputs(YEAR, MONTH, feedsFor(injected));
const inputByCode: Record<string, PayrollInput> = {};
for (const i of assembled.inputs) inputByCode[i.empCode] = i;

function scaled(i: PayrollInput): PayrollInput {
  const f = i.workingDays / 31;
  const d = i.days;
  return { ...i, days: { present: d.present * f, ph: d.ph * f, el: d.el * f, cl: d.cl * f, sl: d.sl * f, plo: d.plo * f, weekOff: d.weekOff * f }, otHours: i.otHours * f };
}
const u2Eligible = (i: PayrollInput) => i.category === 'STAFF' || (i.rateProfile?.basis === 'MONTHLY_GROSS_PRORATED');

const rows: Row[] = [];
const extra: Record<string, any> = {};

const SNAPSHOT_CFG = { ...DEFAULT_ENGINE_CONFIG, workerOtVdaBasis: 'MASTER_SNAPSHOT' as const, workerMasterVdaSnapshot: 2790 };
const sumDed = (d: Record<string, number>) => Object.values(d || {}).reduce((x, y) => x + y, 0);

function classify(code: string, pop: string, sheetNet: number, archNet: number | null): void {
  const inp = inputByCode[code];
  const push = (r: Row, ex?: any) => { rows.push(r); if (ex) extra[code] = ex; };
  if (!inp) { push({ code, pop, cls: 'UNEXPLAINED', sheetNet, archNet, rawNet: null, scaledNet: null, dRaw: null, dScaled: null, note: 'no engine input assembled (employee inactive/missing in app?)' }); return; }
  const raw = calculateOne(inp, DEFAULT_ENGINE_CONFIG);
  if (raw.held) { push({ code, pop, cls: 'HELD', sheetNet, archNet, rawNet: null, scaledNet: null, dRaw: null, dScaled: null, held: raw.blockers }, { input: inp, raw }); return; }
  const sc = u2Eligible(inp) ? calculateOne(scaled(inp), DEFAULT_ENGINE_CONFIG) : null;
  const dRaw = r2(raw.netPay! - sheetNet);
  const dSc = sc && !sc.held ? r2(sc.netPay! - sheetNet) : null;
  const a = archive[code];
  let cls: Cls = 'UNEXPLAINED'; let note: string | undefined;
  if (Math.abs(dRaw) <= TOL) cls = 'EXACT';
  else if (dSc !== null && Math.abs(dSc) <= TOL) cls = 'U2';
  else if (inp.category === 'PERMANENT_WORKER') {
    const prodSheet = 8500 - (a?.deductions?.PROD_OFFSET ?? 0);
    const alt = r2(raw.netPay! - raw.earnings.PROD_ALLOWANCE + prodSheet - sheetNet);
    const snap = calculateOne(inp, SNAPSHOT_CFG);
    const dSnap = snap.held ? null : r2(snap.netPay! - sheetNet);
    if (Math.abs(alt) <= TOL) { cls = 'U5'; note = `prod allowance differs (engine ${raw.earnings.PROD_ALLOWANCE} vs sheet net-of-offset ${prodSheet})`; }
    else if (dSnap !== null && Math.abs(dSnap) <= TOL) { cls = 'VDAOT'; note = `OT priced on CURRENT_RATE VDA (103 x wd) per owner decision 20 Oct 2026; MASTER_SNAPSHOT (2790) run clears: delta ${dSnap}`; }
    else note = `after MASTER_SNAPSHOT OT basis residual ${dSnap}`;
  } else if (inp.category === 'STAFF' && sc && !sc.held && a?.te !== undefined) {
    const sheetFG = a.te / (a.worked / 31); const liveFG = inp.masters!.FIXED_GROSS!;
    const extraAmt = r2(sheetNet - (a.te + a.otpay - sumDed(a.deductions)));
    if (Math.abs(extraAmt) > 5) {
      cls = 'SHEETEXTRA'; note = `sheet net exceeds its own components (earnings + OT - deductions) by ${extraAmt}: amount not in any earnings line; engine has no earnings-adjustment input`;
    } else if (Math.abs(sheetFG - liveFG) > 1.5) {
      const alt = calculateOne(scaled({ ...inp, masters: { ...inp.masters, FIXED_GROSS: Math.round(sheetFG) } }), DEFAULT_ENGINE_CONFIG);
      const dAlt = alt.held ? null : r2(alt.netPay! - sheetNet);
      cls = 'U6'; note = `live master FIXED_GROSS ${r2(liveFG)} vs sheet-implied ${r2(sheetFG)} (delta ${r2(liveFG - sheetFG)}); with the sheet-implied master the scaled net delta is ${dAlt}`;
    } else {
      let best: number | null = null, bestAdj: number | null = null;
      for (let k = -1; k <= 1; k++) {
        const fg = Math.round(liveFG) + k; if (Math.round(0.4 * fg) !== Math.round(inp.masters!.BASIC!)) continue;
        const alt = calculateOne(scaled({ ...inp, masters: { ...inp.masters, FIXED_GROSS: fg } }), DEFAULT_ENGINE_CONFIG);
        if (alt.held) continue;
        const d = r2(alt.netPay! - sheetNet);
        if (best === null || Math.abs(d) < Math.abs(best)) best = d;
        // the engine pays the SUM of nine integer-rounded components; the sheet pays its unrounded gross (te)
        const comps = Object.entries(alt.earnings).filter(([k2]) => k2 !== 'OT').reduce((x, [, v]) => x + v, 0);
        const dAdj = r2(alt.netPay! + (a.te - comps) + (alt.deductions.ESI - (a.deductions.ESI ?? 0)) - sheetNet);
        if (bestAdj === null || Math.abs(dAdj) < Math.abs(bestAdj)) bestAdj = dAdj;
      }
      if ((best !== null && Math.abs(best) <= TOL) || (bestAdj !== null && Math.abs(bestAdj) <= TOL)) {
        cls = 'U1R';
        note = `rounding only: engine = basic/0.40 (${r2(liveFG)}) then pays the sum of nine integer-rounded components; sheet pays its own unrounded gross, rounds ESI to whole rupees and net to whole rupees. Scaled delta ${dSc}; with sheet-consistent integer master gross ${best}; after also substituting the sheet's unrounded gross for the component sum and the sheet's whole-rupee ESI ${bestAdj}`;
      }
    }
  }
  push({ code, pop, cls, sheetNet, archNet, rawNet: raw.netPay, scaledNet: sc && !sc.held ? sc.netPay : null, dRaw, dScaled: dSc, note }, { input: inp, raw, scaled: sc });
}

// STAFF
for (const a of D.archive.filter((x: any) => x.category === 'STAFF')) classify(a.emp_code, 'STAFF', a.net, a.net);
// WORKERS
for (const a of D.archive.filter((x: any) => x.category === 'PERMANENT_WORKER')) classify(a.emp_code, 'PERMANENT_WORKER', a.net, a.net);
// CONSULTANTS
for (const a of D.archive.filter((x: any) => x.category === 'CONSULTANT')) classify(a.emp_code, 'CONSULTANT', a.net, a.net);
// PUNE: sheet reference = Sept-tab payable (incomplete: Gross Earnings column blank) AND reconstruction with the sheet's own July-tab formula
for (const p of D.sheet.pune) {
  const wd = p.wd;
  const recon = r2(Math.round(p.gross * p.worked / wd) - (p.totalDed ?? 0) + (p.otherAllow ?? 0));
  const arch = archive[p.emp_code]?.net ?? null;
  const code = p.emp_code;
  const inp = inputByCode[code];
  const raw = inp ? calculateOne(inp, DEFAULT_ENGINE_CONFIG) : null;
  if (!raw) { rows.push({ code, pop: 'PUNE_STAFF', cls: 'UNEXPLAINED', sheetNet: recon, archNet: arch, rawNet: null, scaledNet: null, dRaw: null, dScaled: null, note: 'no input' }); continue; }
  if (raw.held) { rows.push({ code, pop: 'PUNE_STAFF', cls: 'HELD', sheetNet: recon, archNet: arch, rawNet: null, scaledNet: null, dRaw: null, dScaled: null, held: raw.blockers }); continue; }
  const d = r2(raw.netPay! - recon);
  let cls: Cls = Math.abs(d) <= TOL ? 'EXACT' : 'UNEXPLAINED'; let note: string | undefined;
  if (cls !== 'EXACT' && Math.abs(r2(d + (p.otherAllow ?? 0))) <= TOL) cls = 'SHEETEXTRA';
  if (cls === 'SHEETEXTRA') note = `residual equals sheet "Other Allowance" ${p.otherAllow}: positive allowance has no engine input (feedSync warns, adjustments)`;
  rows.push({ code, pop: 'PUNE_STAFF', cls, sheetNet: recon, archNet: arch, rawNet: raw.netPay, scaledNet: null, dRaw: d, dScaled: null, note });
  extra[code] = { input: inp, raw, pune: p };
}

// ---- coverage ------------------------------------------------------------------------------
const activeApp = new Set<string>(D.employees.filter((e: any) => e.is_active).map((e: any) => e.emp_code));
const inAppNotSheet = [...activeApp].filter((c) => !sheetCodes.has(c)).sort();
const inSheetNotApp = [...sheetCodes].filter((c) => !activeApp.has(c)).sort();
// hold reasons for app-only people when run with zero days
const appOnlyHold: Record<string, string[]> = {};
{
  const f = feedsFor([]);
  const a = assemblePayrollInputs(YEAR, MONTH, f);
  for (const i of a.inputs) if (inAppNotSheet.includes(i.empCode)) {
    const r = calculateOne(i, DEFAULT_ENGINE_CONFIG); if (r.held) appOnlyHold[i.empCode] = r.blockers;
  }
}

// ---- workers: prove sheet-implied production allowance == round(4500 * present / wd) ---------
const prodProof: { code: string; ok: boolean; d: number }[] = [];
for (const w of D.sheet.workers) {
  const off = archive[w.emp_code]?.deductions?.PROD_OFFSET ?? 0;
  const wd = inputByCode[w.emp_code]?.workingDays ?? 26;
  const implied = 8500 - off, calc = Math.round(4500 * w.present / wd);
  prodProof.push({ code: w.emp_code, ok: Math.abs(implied - calc) <= 1, d: implied - calc });
}
// ---- import fidelity (archive vs Drive tabs) ------------------------------------------------
const fidelity: string[] = [];
for (const w of D.sheet.workers) {
  const a = archive[w.emp_code]; if (!a) { fidelity.push(`${w.emp_code}: in Drive tab, not in archive`); continue; }
  const bad: string[] = [];
  if (a.worked !== w.worked) bad.push(`worked ${a.worked}/${w.worked}`);
  if (Math.abs((a.ot ?? 0) - w.ot) > 0.01) bad.push(`ot ${a.ot}/${w.ot}`);
  if (Math.abs(a.net - w.net) > 0.5) bad.push(`net ${a.net}/${w.net}`);
  if (Math.abs((a.deductions?.PROD_OFFSET ?? 0) - w.prodOffset) > 0.5) bad.push('prodOffset');
  if (Math.abs((a.deductions?.SOCIETY ?? 0) - w.society) > 0.5) bad.push('society');
  if (Math.abs((a.deductions?.CANTEEN ?? 0) - w.canteen) > 0.5) bad.push('canteen');
  if (a.vda !== undefined && Math.round(a.vda / 103) !== w.present) bad.push(`present(VDA/103) ${Math.round(a.vda / 103)}/${w.present}`);
  if (bad.length) fidelity.push(`${w.emp_code}: ${bad.join(', ')}`);
}
for (const c of D.sheet.consultants) {
  const a = archive[c.emp_code]; if (!a) { fidelity.push(`${c.emp_code}: in Drive tab, not in archive`); continue; }
  const bad: string[] = [];
  if (a.worked !== c.worked) bad.push(`worked ${a.worked}/${c.worked}`);
  if (Math.abs((a.ot ?? 0) - c.ot) > 0.01) bad.push(`ot ${a.ot}/${c.ot}`);
  if (Math.abs(a.net - c.net) > 0.5) bad.push(`net ${a.net}/${c.net}`);
  if (bad.length) fidelity.push(`${c.emp_code}: ${bad.join(', ')}`);
}
for (const p of D.sheet.pune) {
  const a = archive[p.emp_code];
  if (!a) { if (p.payable !== 0) fidelity.push(`${p.emp_code}: Drive payable ${p.payable} but not in archive`); continue; }
  if (Math.abs(a.net - p.payable) > 0.5) fidelity.push(`${p.emp_code}: net ${a.net}/${p.payable}`);
  if (a.worked !== p.worked) fidelity.push(`${p.emp_code}: worked ${a.worked}/${p.worked}`);
}

// ---- output ---------------------------------------------------------------------------------
const pops = ['STAFF', 'PERMANENT_WORKER', 'CONSULTANT', 'PUNE_STAFF'];
console.log('population          sheet calc held exact U2  U5  U1R VDA U6  EXTRA UNEXPL');
let totUn = 0, totHeld = 0, totNotStrict = 0;
for (const p of pops) {
  const r = rows.filter((x) => x.pop === p);
  const c = (k: Cls) => r.filter((x) => x.cls === k).length;
  console.log(`${p.padEnd(19)} ${String(r.length).padStart(5)} ${String(r.length - c('HELD')).padStart(4)} ${String(c('HELD')).padStart(4)} ${String(c('EXACT')).padStart(5)} ${String(c('U2')).padStart(3)} ${String(c('U5')).padStart(3)} ${String(c('U1R')).padStart(3)} ${String(c('VDAOT')).padStart(3)} ${String(c('U6')).padStart(3)} ${String(c('SHEETEXTRA')).padStart(5)} ${String(c('UNEXPLAINED')).padStart(6)}`);
  totUn += c('UNEXPLAINED'); totHeld += c('HELD'); totNotStrict += r.filter((x) => !STRICT_OK.includes(x.cls) && x.cls !== 'HELD').length;
}
console.log('\nHELD:'); for (const r of rows.filter((x) => x.cls === 'HELD')) console.log(`  ${r.code} ${r.pop} ${r.held!.join(',')} (sheet net ${r.sheetNet})`);
console.log('\nNOT-STRICT (code pop class dRaw dScaled note):');
for (const r of rows.filter((x) => !STRICT_OK.includes(x.cls) && x.cls !== 'HELD')) console.log(`  ${r.code} ${r.pop} ${r.cls} raw ${r.dRaw} scaled ${r.dScaled} ${r.note ?? ''}`);
console.log('\nU2-explained codes:', rows.filter((x) => x.cls === 'U2').map((x) => x.code).join(' '));
console.log('U5-explained codes:', rows.filter((x) => x.cls === 'U5').map((x) => x.code).join(' ') || '(none)');
console.log('\nprod-allowance proof: ' + prodProof.filter((p) => p.ok).length + '/' + prodProof.length + ' workers have 8500-offset == round(4500*present/wd)' + (prodProof.some((p) => !p.ok) ? ' ; off: ' + prodProof.filter((p) => !p.ok).map((p) => p.code + '(' + p.d + ')').join(' ') : ''));
console.log('\nimport fidelity (archive vs Drive tabs): ' + (fidelity.length ? '\n  ' + fidelity.join('\n  ') : 'no differences'));
console.log('\nin app (active) but not in Sept sheet:', inAppNotSheet.join(' ') || '(none)');
console.log('app-only hold reasons (zero-day run):', JSON.stringify(appOnlyHold));
console.log('in Sept sheet but not active in app:', inSheetNotApp.join(' ') || '(none)');
console.log('assemble warnings:', assembled.warnings.length, ' blocked:', JSON.stringify(assembled.blockedEmployees));
console.log(`\nVERDICT: ${totNotStrict === 0 && totHeld === 0 ? 'PASS' : 'FAIL'} (strict bar: not EXACT/U2/U5 = ${totNotStrict} [of which no documented cause = ${totUn}], holds ${totHeld})`);

if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ rows, extra, inAppNotSheet, inSheetNotApp, appOnlyHold, prodProof, fidelity, warnings: assembled.warnings }, null, 1));
