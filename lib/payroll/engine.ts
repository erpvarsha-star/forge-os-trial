/**
 * Forge OS — Payroll Engine
 * Faithful TypeScript port of HR OS Apps Script calculation layer:
 *   calcStaff (gs ~6100), calcWorker (~6178), calc_simple_ (~6282),
 *   calc_pf_ (~6087), calc_mlwf_ (~6091), ptAmount (~5819), efficiencySlab (~5841).
 *
 * Verified against actual September 2026 payouts:
 *   19 PERMANENT_WORKER + 7 CONSULTANT rows reproduce paid nets exactly
 *   (see scripts/payroll-engine.sept2026.test.ts).
 *
 * Known intentional divergence: worker OT VDA basis. Old sheets froze the
 * master VDA snapshot (2,790 for Sep-26); the new HR OS code uses the current
 * rate (103 x wd). Controlled by config.workerOtVdaBasis, default CURRENT_RATE.
 */
import {
  PayrollInput, PayrollResult, EngineConfig, DEFAULT_ENGINE_CONFIG,
  STAFF_COMPONENT_PCTS, prodSlabFor, ptAmount,
} from './types';

export { DEFAULT_ENGINE_CONFIG };
export type { EngineConfig, PayrollInput, PayrollResult } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;

function workedDays(input: PayrollInput): number {
  const d = input.days;
  const base = d.present + d.ph + d.el + d.cl + d.sl + d.plo;
  // Workers' w EXCLUDES week-off days; staff/consultants include them.
  return input.category === 'PERMANENT_WORKER' ? base : base + d.weekOff;
}

function pfEmployee(pfWage: number, cfg: EngineConfig): number {
  return pfWage <= cfg.pfCeiling ? r2(pfWage * 0.12) : cfg.pfCappedAmount;
}

function ptFor(gross: number, input: PayrollInput, cfg: EngineConfig): number {
  if (input.ptExempt) return 0;
  if (input.gender === 'F' && gross <= cfg.ptWomenExemptUpto) return 0;
  return ptAmount(gross, input.month, cfg);
}

function mlwf(input: PayrollInput, cfg: EngineConfig): number {
  return (input.month === 6 || input.month === 12) ? cfg.mlwfAmount : 0;
}

function calcStaff(input: PayrollInput, cfg: EngineConfig): PayrollResult {
  const m = input.masters;
  const res = blank(input);
  if (!m?.FIXED_GROSS) { res.blockers.push('MISSING_MASTERS'); return finish(res); }
  const wd = input.workingDays, w = workedDays(input);
  const gross = r2(m.FIXED_GROSS * w / wd);
  const comp: Record<string, number> = {};
  for (const [k, p] of Object.entries(STAFF_COMPONENT_PCTS)) comp[k] = Math.round(gross * p);
  const pfWage = comp.BASIC + comp.CONVEYANCE + comp.EDUCATION + comp.MEDICAL;
  const pf = pfEmployee(pfWage, cfg);
  const esi = m.FIXED_GROSS <= cfg.esiCeiling ? r2(m.FIXED_GROSS * 0.0075 / wd * w) : 0;
  const basicPM = STAFF_COMPONENT_PCTS.BASIC * m.FIXED_GROSS;
  const otPay = r2((basicPM / wd / 8) * 2 * input.otHours);
  const pt = ptFor(gross, input, cfg);
  const mlf = mlwf(input, cfg);
  res.worked = w;
  res.earnings = { ...comp, OT: otPay };
  res.deductions = {
    PF: pf, ESI: esi, PT: pt, MLWF: mlf,
    CANTEEN: input.deductions.canteen, SOCIETY: input.deductions.society,
    ADVANCE: input.deductions.advance, OTHER: input.deductions.other ?? 0,
  };
  res.otPay = otPay;
  res.employer = {
    pf: r2(pfWage * 0.1301),
    bonus: r2(comp.BASIC * 0.0833),
    gratuity: r2(comp.BASIC * 0.0483),
  };
  return finish(res);
}

function calcWorker(input: PayrollInput, cfg: EngineConfig): PayrollResult {
  const m = input.masters;
  const res = blank(input);
  if (!m?.BASIC && m?.BASIC !== 0) { res.blockers.push('MISSING_MASTERS'); return finish(res); }
  const wd = input.workingDays, w = workedDays(input);
  const pp = input.days.present; // physical present drives VDA + prod allowance
  const perDay = (x: number) => r2(x / wd * w);
  const basic = perDay(m.BASIC ?? 0);
  const hra = perDay(m.HRA ?? 0);
  const conv = perDay(m.CONVEYANCE ?? 0);
  const wash = perDay(m.WASHING ?? 0);
  const edu = perDay(m.EDUCATION ?? 0);
  const heat = (m.HEAT ?? 0) === 150 ? r2(w * 5.78) : 0;
  const vda = r2(cfg.workerVdaRatePerDay * pp); // VDA on PHYSICAL present days only
  const slab = prodSlabFor(input.efficiencyPct ?? null);
  if (slab === null) res.warnings.push('EFFICIENCY_MISSING: production allowance set to 0');
  const prod = r2(Math.min(slab ?? 0, Math.round((slab ?? 0) * pp / wd)));
  const vdaForOt = cfg.workerOtVdaBasis === 'MASTER_SNAPSHOT'
    ? (cfg.workerMasterVdaSnapshot ?? 0)
    : cfg.workerVdaRatePerDay * wd;
  const otPay = r2(((m.BASIC + vdaForOt) / wd / 8) * 2 * input.otHours);
  const totalEarnings = r2(basic + hra + conv + wash + edu + heat + vda + prod + otPay);
  const pfWage = r2(basic + vda);
  const pf = pfEmployee(pfWage, cfg);
  const pt = ptFor(totalEarnings, input, cfg);
  const mlf = mlwf(input, cfg);
  res.worked = w;
  res.earnings = { BASIC: basic, HRA: hra, CONVEYANCE: conv, WASHING: wash, EDUCATION: edu, HEAT: heat, VDA: vda, PROD_ALLOWANCE: prod, OT: otPay };
  res.deductions = {
    PF: pf, PT: pt, MLWF: mlf,
    CANTEEN: input.deductions.canteen, SOCIETY: input.deductions.society,
    ADVANCE: input.deductions.advance, OTHER: input.deductions.other ?? 0,
  };
  res.otPay = otPay;
  res.employer = {
    pf: r2(pfWage * 0.1301),
    bonus: r2(pfWage * 0.18),
    gratuity: r2(pfWage * 0.0481),
  };
  return finish(res);
}

function calcSimple(input: PayrollInput, cfg: EngineConfig): PayrollResult {
  const rp = input.rateProfile;
  const res = blank(input);
  if (!rp?.basis) { res.blockers.push('MISSING_RATE'); return finish(res); }
  const wd = input.workingDays, w = workedDays(input);
  let gross: number, otPay = 0;
  if (rp.basis === 'DAILY_RATE') {
    if (rp.rateAmount == null) { res.blockers.push('MISSING_RATE'); return finish(res); }
    gross = r2(rp.rateAmount * w);
    otPay = r2((rp.rateAmount / 8) * input.otHours); // x1, not x2
  } else {
    if (rp.monthlyGross == null) { res.blockers.push('MISSING_RATE'); return finish(res); }
    gross = r2(rp.monthlyGross * w / wd);
    if (input.otHours > 0) {
      if (input.category === 'CONSULTANT') {
        res.blockers.push('CONSULTANT_OT'); // consultants cannot be paid OT
        otPay = 0;
      } else {
        otPay = r2((rp.monthlyGross / wd / 8) * input.otHours); // PUNE_STAFF x1
      }
    }
  }
  // No PF / ESI / PT / MLWF for consultant categories.
  res.worked = w;
  res.earnings = { GROSS: gross, OT: otPay };
  res.deductions = {
    CANTEEN: input.deductions.canteen, SOCIETY: input.deductions.society,
    ADVANCE: input.deductions.advance, OTHER: input.deductions.other ?? 0,
  };
  res.otPay = otPay;
  return finish(res);
}

function blank(input: PayrollInput): PayrollResult {
  return {
    empCode: input.empCode, category: input.category, worked: 0,
    earnings: {}, deductions: {}, totalEarnings: 0, totalDeductions: 0,
    netPay: null, otPay: 0, employer: { pf: 0, bonus: 0, gratuity: 0 },
    blockers: [], warnings: [], held: false,
  };
}

function finish(res: PayrollResult): PayrollResult {
  res.totalEarnings = r2(Object.values(res.earnings).reduce((a, b) => a + b, 0));
  res.totalDeductions = r2(Object.values(res.deductions).reduce((a, b) => a + b, 0));
  if (res.blockers.length > 0) { res.held = true; res.netPay = null; return res; }
  const net = r2(res.totalEarnings - res.totalDeductions);
  if (net < 0) { res.blockers.push('NET_NEGATIVE'); res.held = true; res.netPay = null; return res; }
  res.netPay = net;
  return res;
}

export function calculateOne(input: PayrollInput, cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): PayrollResult {
  switch (input.category) {
    case 'STAFF': return calcStaff(input, cfg);
    case 'PERMANENT_WORKER': return calcWorker(input, cfg);
    case 'CONSULTANT':
    case 'PUNE_STAFF': return calcSimple(input, cfg);
  }
}

export function calculateRun(inputs: PayrollInput[], cfg: EngineConfig = DEFAULT_ENGINE_CONFIG): PayrollResult[] {
  return inputs.map((i) => calculateOne(i, cfg));
}
