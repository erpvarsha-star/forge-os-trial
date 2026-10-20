// VENDORED COPY of lib/payroll/lifecycle.ts — do not edit here; edit the source and re-vendor.
/**
 * Forge OS — Employee lifecycle state machine + payroll inclusion rules.
 *
 * Statuses (stored in employee_status_history, effective-dated):
 *   active | on_leave | left | terminated | retired | rehired
 * ('draft' exists in the DB enum for legacy rows; not used in app flows.)
 *
 * Category change is NOT a lifecycle event. When someone moves category
 * (e.g. PERMANENT_WORKER -> STAFF), close the old salary-structure row
 * (effective_to = day before) and open a new row with the new category
 * (effective_from). The engine simply reads whatever is active each day —
 * mid-month conversions prorate naturally by day-split runs.
 */

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'left', 'terminated', 'retired', 'rehired'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  active: ['on_leave', 'left', 'terminated', 'retired'],
  on_leave: ['active', 'left', 'terminated', 'retired'],
  // Terminal states: only rehired can reopen, and only from left/retired.
  left: ['rehired'],
  retired: ['rehired'],
  terminated: [],          // termination is final; a mistake is corrected by HR via note + new history row, never edit
  rehired: ['active'],
};

export function canTransitionEmployee(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return EMPLOYEE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Is this person included in a pay run for [periodStart, periodEnd]? */
export function isPayrollEligible(
  events: { status: EmployeeStatus; effectiveFrom: string }[],
  periodStart: string, periodEnd: string,
): { eligible: boolean; paidUntil: string | null; reason?: string } {
  // Sort by date; find status as of periodEnd.
  const sorted = [...events].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let current: EmployeeStatus = 'active';
  let exitDate: string | null = null;
  for (const e of sorted) {
    if (e.effectiveFrom > periodEnd) break;
    current = e.status;
    if (e.status === 'left' || e.status === 'terminated' || e.status === 'retired') exitDate = e.effectiveFrom;
    if (e.status === 'rehired' || e.status === 'active') exitDate = null;
  }
  if (exitDate && exitDate < periodStart) {
    return { eligible: false, paidUntil: exitDate, reason: `${current} before period start` };
  }
  if (exitDate) {
    // Exited mid-period: pay up to last working day (day before effectiveFrom).
    const d = new Date(exitDate); d.setDate(d.getDate() - 1);
    return { eligible: true, paidUntil: d.toISOString().slice(0, 10), reason: `partial month (${current})` };
  }
  return { eligible: true, paidUntil: null };
}

/**
 * Full & final: exit months run as a normal pay run (prorated to paidUntil);
 * any settlement beyond that (notice pay, encashment) goes through an
 * ADJUSTMENT run referencing the archived exit-month run — never edit it.
 */
export const FULL_AND_FINAL_VIA = 'adjustment_run' as const;
