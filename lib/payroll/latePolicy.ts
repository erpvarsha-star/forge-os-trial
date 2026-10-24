// ===========================================================================================
// PENDING OWNER CONFIRMATION — formula may change; THIS IS THE SINGLE PLACE TO EDIT.
//
// Proposed late-arrival deduction: pro-rata on an 8-hour (480-minute) working day.
//   deduction = lateMinutes / 480 * dayRate   (rounded to 2 decimals)
//
// NOT WIRED ANYWHERE. The payroll engine (lib/payroll/engine.ts) is frozen and neither feedSync nor
// payroll-run call this. A warning decided 'deduct' currently has NO automatic payroll effect: it is
// only a recorded decision (and subject to the AI review). Wiring this in needs an explicit owner
// sign-off on the formula and on which pay component supplies `dayRate`.
// ===========================================================================================
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lateDeductionAmount(lateMinutes: number, dayRate: number): number {
  if (!Number.isFinite(lateMinutes) || !Number.isFinite(dayRate) || lateMinutes <= 0 || dayRate <= 0) return 0;
  return round2((lateMinutes / 480) * dayRate);
}
