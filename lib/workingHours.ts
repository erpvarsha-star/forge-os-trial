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
  if (shiftName === 'General') return 9
  if (shiftName === 'Shift 4' || shiftName === 'Shift 5') return 12
  return MIN_WORKING_HOURS
}

// Resolves the hours a day should count as for reporting: the real
// hours_worked if a checkout was recorded, otherwise the shift default
// above. Never returns null/undefined, so a report can sum or average
// this without special-casing missing checkouts.
export function effectiveHoursWorked(hoursWorked: number | null | undefined, shiftName: string | null | undefined): number {
  return typeof hoursWorked === 'number' ? hoursWorked : defaultHoursForShift(shiftName)
}
