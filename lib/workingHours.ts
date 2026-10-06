// Yash's decisions on working-hours mapping (27-28 Sep 2026) — see CLAUDE.md
// "Working hours mapping (NOT salary)". Kept in one place so any screen or
// report built later applies the same numbers instead of re-deriving them.

// Floor below which a day counts as short, same for every shift type —
// "min working hrs for each is 8.30 hrs" (8 hours 30 minutes).
export const MIN_WORKING_HOURS = 8.5

// "IF THERE IS NO CHECK OUT PERSON SHOULD BE CONSIDERED AS WORKED NORMAL
// SHIFT HRS. 8.5/9 HRS AS PER ROLE" — a day where the employee checked in
// but never checked out (attendance_records.hours_worked is null) is NOT
// short and NOT unknown; it counts as a normal full day for whichever
// shift they were on. General is 9h (09:00-18:00, exact); every other
// shift (Shift 1/2/3, Security Day/Night) defaults to the 8.5h floor —
// Yash gave only these two numbers, not a per-shift figure.
//
// Shift 4 (07:00-19:00, PATCH_64) and Shift 5 (19:00-07:00, PATCH_63),
// both 29 Sep 2026 — the day/night OT variants of Shift 1/Shift 3 — are
// genuine 12h shifts, not 8h ones. Claude's own extension of the same
// "match the shift's own nominal duration" rule already used for General,
// not a number Yash gave. MIN_WORKING_HOURS (the 8.5h short-hours floor)
// is unchanged and still applies uniformly per the locked decision ("same
// floor for every shift type") — this only affects the no-checkout
// default, a different question.
export function defaultHoursForShift(shiftName: string | null | undefined): number {
  // 'General (Pune)' (PATCH_71, 6 Oct 2026, Kajal/VFL1567) is the same 9h
  // nominal schedule as General, just at a different clock time — grouped
  // with it here rather than listed separately, since this function's own
  // promise is "match the shift's own nominal duration," and that duration
  // is identical for both.
  if (shiftName === 'General' || shiftName === 'General (Pune)') return 9
  if (shiftName === 'Shift 4' || shiftName === 'Shift 5') return 12
  return MIN_WORKING_HOURS
}

// ---------------------------------------------------------------------------
// Shift finalization + overtime — Yash, 6 Oct 2026.
// ---------------------------------------------------------------------------
//
// Someone who ends up working 12h or more on what was Shift 1 (day,
// 07:00-15:30) or Shift 3 (night, 00:00-07:00) was actually working the OT
// variant of that shift — Shift 4 or Shift 5 respectively — not doing a
// freak 12h stint on an 8.5h shift. Yash's exact words: "he could be
// working 2 hrs overtime also so will not be shift 4 but given 2 hrs
// overtime. if he works 12 hrs or more than 12 hrs. shift 4/5 plus the
// extra hrs." So: under 12h stays on the original shift and overtime is
// just the excess over that shift's own nominal hours; at/above 12h the
// day is reclassified to the OT shift and overtime is the excess over 12.
//
// This applies no matter whether the day's shift was HR-assigned or
// inferred (lib/shiftInference.ts) — Yash's rule carried no carve-out for
// an assigned shift. There is deliberately no symmetric "under 8.5h ->
// reclassify down" rule — not asked for.
//
// Overtime is VISIBILITY ONLY ("just a count for now") — same precedent as
// "Working hours mapping (NOT salary)" above. It is never read by payroll.
//
// Pure function, no DB/Supabase access on purpose: the exact same logic is
// hand-ported (Apps-Script-style duplication, same pattern already used
// for defaultHoursForShift() in scripts/AttendanceReport.gs) into the
// Deno auto-checkout edge function, which cannot import this file.
// Keep both copies in sync by hand if this threshold ever changes.
export interface ShiftFinalizationResult {
  /** Name of the shift this day should be reclassified to (the caller
   *  resolves this to a real `shifts.id` and updates `employee_shifts` —
   *  this function never touches the DB), or null to leave the day's
   *  shift exactly as it already was. */
  reclassifyToShiftName: string | null
  /** Always >= 0. Visibility-only; never fed into payroll or run-payroll. */
  overtimeHours: number
}

const OVERTIME_RECLASSIFY_HOURS_THRESHOLD = 12

// Day shift -> its day OT variant; night shift -> its night OT variant.
const OVERTIME_RECLASSIFY_TARGET: Record<string, string> = {
  'Shift 1': 'Shift 4',
  'Shift 3': 'Shift 5',
}

export function finalizeShiftAndOvertime(
  shiftName: string | null | undefined,
  hoursWorked: number
): ShiftFinalizationResult {
  const target = shiftName ? OVERTIME_RECLASSIFY_TARGET[shiftName] : undefined
  if (target && hoursWorked >= OVERTIME_RECLASSIFY_HOURS_THRESHOLD) {
    return {
      reclassifyToShiftName: target,
      overtimeHours: Math.round((hoursWorked - OVERTIME_RECLASSIFY_HOURS_THRESHOLD) * 100) / 100,
    }
  }
  const nominal = defaultHoursForShift(shiftName)
  return {
    reclassifyToShiftName: null,
    overtimeHours: Math.max(0, Math.round((hoursWorked - nominal) * 100) / 100),
  }
}

// Resolves the hours a day should count as for reporting: the real
// hours_worked if a checkout was recorded, otherwise the shift default
// above. Never returns null/undefined, so a report can sum or average
// this without special-casing missing checkouts.
export function effectiveHoursWorked(hoursWorked: number | null | undefined, shiftName: string | null | undefined): number {
  return typeof hoursWorked === 'number' ? hoursWorked : defaultHoursForShift(shiftName)
}
