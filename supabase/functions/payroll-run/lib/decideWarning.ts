// Pure helpers for payroll-run 'decide_warning' (no I/O, no Deno APIs — unit-tested with tsx).
// NOT vendored: function-local, like warnings.ts. lateDeductionAmount mirrors lib/payroll/latePolicy.ts
// (the documented source of the formula) — keep both in sync by hand.

export const DEDUCT_FROM_NTH_LATE = 4;
/** adjustment_type feedSync honours: it applies EVERY approved negative payroll_adjustments row to
 *  deductions.other regardless of type; OTHER_DEDUCTION is the schema's generic-deduction type (PATCH_91). */
export const LATE_ADJUSTMENT_TYPE = 'OTHER_DEDUCTION';

export interface WarningRow { id: string; run_id: string; employee_code: string; warning_type: string; detail: any; decision: string }

/** Owner rule B: a deduction can only ever come from a late_excess flagged as the 4th+ >30-min late. */
export function isDeductEligible(w: Pick<WarningRow, 'warning_type' | 'detail'>): boolean {
  return w.warning_type === 'late_excess' && w.detail?.deduct_eligible === true &&
    Number(w.detail?.nth_over_30) >= DEDUCT_FROM_NTH_LATE;
}

/** Reason text when a 'deduct' decision does NOT produce an adjustment; null when it does (or n/a). */
export function deductionSkippedReason(w: Pick<WarningRow, 'warning_type' | 'detail'>, decision: string): string | null {
  if (decision !== 'deduct' || w.warning_type !== 'late_excess' || isDeductEligible(w)) return null;
  const n = Number(w.detail?.nth_over_30);
  return `not eligible (late #${Number.isFinite(n) && n > 0 ? n : '?'} < ${DEDUCT_FROM_NTH_LATE})`;
}

export function lateDeductionAmount(lateMinutes: number, dayRate: number): number {
  if (!Number.isFinite(lateMinutes) || !Number.isFinite(dayRate) || lateMinutes <= 0 || dayRate <= 0) return 0;
  return Math.round((lateMinutes / 480) * dayRate);
}

/** Idempotency key stored in payroll_adjustments.source_reference. */
export const sourceReference = (warningId: string) => `warning:${warningId}`;

/**
 * Day rate = what payroll itself pays for ONE day, mirroring the frozen engine's per-day basis:
 *  - STAFF: FIXED_GROSS / workingDays                     (engine calcStaff: gross = FIXED_GROSS * w / wd)
 *  - PERMANENT_WORKER: (BASIC+HRA+CONVEYANCE+WASHING+EDUCATION) / workingDays  (engine perDay())
 *      + VDA per-day rate (cfg.workerVdaRatePerDay; paid per present day) + heat allowance 5.78 when HEAT = 150.
 *      Production allowance is excluded (efficiency-driven, not a fixed per-day pay).
 *  - CONSULTANT / PUNE_STAFF: DAILY_RATE -> rateAmount; MONTHLY_GROSS_PRORATED -> monthlyGross / workingDays.
 * Returns 0 when the input has no usable pay basis (caller must refuse, never guess).
 */
export function dayRateFor(input: any, vdaPerDay: number): number {
  const m = input?.masters, rp = input?.rateProfile, wd = Number(input?.workingDays);
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  if (!(wd > 0)) return 0;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (input.category === 'STAFF') return m?.FIXED_GROSS ? r2(m.FIXED_GROSS / wd) : 0;
  if (input.category === 'PERMANENT_WORKER') {
    if (!m) return 0;
    const fixed = n(m.BASIC) + n(m.HRA) + n(m.CONVEYANCE) + n(m.WASHING) + n(m.EDUCATION);
    return r2(fixed / wd + n(vdaPerDay) + (n(m.HEAT) === 150 ? 5.78 : 0));
  }
  if (rp?.basis === 'DAILY_RATE') return n(rp.rateAmount);
  if (rp?.basis === 'MONTHLY_GROSS_PRORATED') return rp.monthlyGross ? r2(rp.monthlyGross / wd) : 0;
  return 0;
}

export interface AdjustmentRowArgs {
  payrollMonth: string; employeeId: string; amount: number; warningId: string;
  lateMinutes: number; date: string; nth: number; actorEmployeeId: string; nowIso: string;
}
export function buildAdjustmentRow(a: AdjustmentRowArgs) {
  return {
    payroll_month: a.payrollMonth,
    employee_id: a.employeeId,
    adjustment_type: LATE_ADJUSTMENT_TYPE,
    signed_amount_inr: -Math.abs(a.amount),
    reason: `Late arrival deduction: ${a.lateMinutes} min on ${a.date} (late #${a.nth} of month)`,
    source_reference: sourceReference(a.warningId),
    approval_status: 'approved',
    approved_by: a.actorEmployeeId,
    approved_at: a.nowIso,
    entered_by: a.actorEmployeeId,
  };
}

/** What decide_warning must do with the run so the new adjustment is picked up by a recalculation. */
export function runAction(status: string): 'none' | 'reopen' | 'blocked' | 'busy' {
  if (status === 'draft') return 'none';
  if (status === 'calculated' || status === 'in_review') return 'reopen';
  if (status === 'calculating') return 'busy';
  return 'blocked';
}
