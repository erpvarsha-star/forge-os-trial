// VENDORED COPY of lib/payroll/extraEarnings.ts — do not edit here; edit the source and re-vendor.
/**
 * Forge OS — extra earnings / recurring adjustments (pure, testable; no I/O).
 * The engine is frozen and has NO input for positive earnings, so these are applied around it
 * (owner decisions 27 Oct 2026):
 *  - recurring_adjustments, applied in FULL (no proration) when is_active and the window overlaps the pay month:
 *      kind 'deduction' -> added to input.deductions.other BEFORE calculateOne (existing supported path);
 *      kind 'earning'   -> added AFTER calculateOne, outside the engine gross (like the sheet's 'Other Allow.').
 *  - PUNE_STAFF only (BUNG home workers): OT = sum(attendance_records.ot_hours) x that employee's flat
 *    employee_salary_structure.ot_rate (NOT the engine formula; the engine gets otHours=0), and
 *    outstation travel = 250 x count of attendance rows with outstation_travel=true.
 * After-engine amounts increase netPay and totalEarnings and appear as separate earnings keys
 * (OTHER_ALLOWANCE, BUNG_OT, OUTSTATION_TRAVEL, APPROVED_EXTRAS) so a printed payslip's gross = sum of printed lines.
 *  - APPROVED_EXTRAS (owner decision 1 Nov 2026): approved positive payroll_adjustments for the pay month.
 * Held employees get no extras. Everything is derived from this calculation's own engine result, so
 * calculating twice never double-adds.
 */
import type { PayrollInput, PayrollResult, EngineConfig } from './types.ts';
import { calculateOne } from './engine.ts';
import { pickSalary } from './feedSync.ts';
import type { SalaryRow } from './feedSync.ts';

export const OUTSTATION_TRAVEL_PER_DAY = 250;

export interface RecurringAdjustmentRow {
  employee_id: string; kind: string; label: string | null; amount: number | string | null;
  active_from: string | null; active_to: string | null; is_active: boolean | null;
}
export interface ExtraAttendanceRow {
  employee_id: string; date: string; ot_hours?: number | string | null; outstation_travel?: boolean | null;
}
export interface ApprovedAdjustmentRow {
  employee_id: string; adjustment_type?: string | null; signed_amount_inr: number | string | null;
  approval_status: string; reason?: string | null;
}
export interface ExtrasFeeds {
  recurring: RecurringAdjustmentRow[];
  /** payroll_adjustments rows already filtered to the pay month; only approved positive ones are paid. */
  adjustments?: ApprovedAdjustmentRow[];
  attendance: ExtraAttendanceRow[];
  salaries: SalaryRow[];
}
export interface ExtraItem { key: 'OTHER_ALLOWANCE' | 'BUNG_OT' | 'OUTSTATION_TRAVEL' | 'APPROVED_EXTRAS'; label: string; amount: number }

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Overlaps the pay month: is_active, active_from <= periodEnd, active_to null or >= periodStart. */
export function recurringApplies(r: RecurringAdjustmentRow, periodStart: string, periodEnd: string): boolean {
  if (r.is_active !== true) return false;
  if (num(r.amount) <= 0) return false;
  if (r.active_from && r.active_from > periodEnd) return false;
  if (r.active_to && r.active_to < periodStart) return false;
  return true;
}

export interface EmployeeExtras {
  recurringDeduction: number;                 // goes into deductions.other before the engine
  items: ExtraItem[];                          // added after the engine
  total: number;
  warnings: string[];
}

export function computeExtras(args: {
  employeeId: string; empCode: string; category: string; periodStart: string; periodEnd: string; feeds: ExtrasFeeds;
}): EmployeeExtras {
  const { employeeId, empCode, category, periodStart, periodEnd, feeds } = args;
  const warnings: string[] = [];
  const items: ExtraItem[] = [];

  const mine = (feeds.recurring ?? []).filter((r) => r.employee_id === employeeId && recurringApplies(r, periodStart, periodEnd));
  const recurringDeduction = r2(mine.filter((r) => r.kind === 'deduction').reduce((s, r) => s + num(r.amount), 0));
  for (const r of mine.filter((r) => r.kind === 'earning')) {
    items.push({ key: 'OTHER_ALLOWANCE', label: (r.label ?? '').trim() || 'Other allowance', amount: r2(num(r.amount)) });
  }

  // Owner decision 1 Nov 2026: HR-approved positive adjustments (overtime, holiday pay, worked-Friday
  // pay, any special case from the Extras report) are paid here, after the engine, as ONE line.
  // Pending / rejected rows are ignored; negative rows are handled by feedSync (deductions.other).
  const approvedPos = (feeds.adjustments ?? []).filter((a) =>
    a.employee_id === employeeId && a.approval_status === 'approved' && num(a.signed_amount_inr) > 0);
  if (approvedPos.length) {
    const amt = r2(approvedPos.reduce((s, a) => s + num(a.signed_amount_inr), 0));
    const single = approvedPos.length === 1 ? ((approvedPos[0].reason ?? '').trim() || (approvedPos[0].adjustment_type ?? '').trim()) : '';
    items.push({ key: 'APPROVED_EXTRAS', label: single || 'Approved extras', amount: amt });
  }

  if (category === 'PUNE_STAFF') {
    const att = (feeds.attendance ?? []).filter((a) => a.employee_id === employeeId && a.date >= periodStart && a.date <= periodEnd);
    const otHours = r2(att.reduce((s, a) => s + num(a.ot_hours), 0));
    if (otHours > 0) {
      const rate = num(pickSalary(feeds.salaries ?? [], employeeId, periodEnd)?.ot_rate);
      if (rate > 0) items.push({ key: 'BUNG_OT', label: 'Overtime', amount: r2(otHours * rate) });
      else warnings.push(`${empCode}: ${otHours} OT hour(s) recorded but no ot_rate on the salary structure — OT paid 0`);
    }
    const travelDays = att.filter((a) => a.outstation_travel === true).length;
    if (travelDays > 0) items.push({ key: 'OUTSTATION_TRAVEL', label: 'Outstation travel', amount: r2(travelDays * OUTSTATION_TRAVEL_PER_DAY) });
  }

  return { recurringDeduction, items, total: r2(items.reduce((s, i) => s + i.amount, 0)), warnings };
}

export interface CalcWithExtras {
  result: PayrollResult;
  items: ExtraItem[];
  extraTotal: number;
  warnings: string[];
}

/**
 * calculateOne wrapped with the extras. The input is copied, never mutated. Held results are returned
 * untouched (no extras). Earnings keys OTHER_ALLOWANCE / BUNG_OT / OUTSTATION_TRAVEL / APPROVED_EXTRAS are summed per key.
 */
export function calculateWithExtras(
  input: PayrollInput, employeeId: string, ctx: { periodStart: string; periodEnd: string; feeds: ExtrasFeeds },
  cfg: EngineConfig,
): CalcWithExtras {
  const ex = computeExtras({
    employeeId, empCode: input.empCode, category: input.category,
    periodStart: ctx.periodStart, periodEnd: ctx.periodEnd, feeds: ctx.feeds,
  });
  const prepared: PayrollInput = {
    ...input,
    // PUNE_STAFF OT comes only from ot_hours x ot_rate, never the engine formula.
    otHours: input.category === 'PUNE_STAFF' ? 0 : input.otHours,
    deductions: {
      ...input.deductions,
      other: (input.deductions.other ?? 0) + ex.recurringDeduction || undefined,
    },
  };
  const base = calculateOne(prepared, cfg);
  if (base.held) return { result: base, items: [], extraTotal: 0, warnings: ex.warnings };
  if (ex.items.length === 0) return { result: base, items: [], extraTotal: 0, warnings: ex.warnings };

  const earnings = { ...base.earnings };
  for (const it of ex.items) earnings[it.key] = r2((earnings[it.key] ?? 0) + it.amount);
  const result: PayrollResult = {
    ...base,
    earnings,
    totalEarnings: r2(base.totalEarnings + ex.total),
    netPay: r2((base.netPay ?? 0) + ex.total),
  };
  return { result, items: ex.items, extraTotal: ex.total, warnings: ex.warnings };
}
