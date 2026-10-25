// ===========================================================================================
// Late-arrival deduction — confirmed by owner 25 Oct 2026; wired through payroll-run decide_warning.
//
//   deduction = Math.round(lateMinutes / 480 * dayRate)   (whole rupees; 480 = 8-hour working day)
//
// Applies ONLY when the warning is a 'late_excess' with detail.deduct_eligible === true (the 4th or later
// late of more than 30 minutes in a month) AND HR decides 'deduct'. The payroll-run edge function carries a
// function-local copy (supabase/functions/payroll-run/lib/decideWarning.ts) — keep both in sync.
// ===========================================================================================
export function lateDeductionAmount(lateMinutes: number, dayRate: number): number {
  if (!Number.isFinite(lateMinutes) || !Number.isFinite(dayRate) || lateMinutes <= 0 || dayRate <= 0) return 0;
  return Math.round((lateMinutes / 480) * dayRate);
}
