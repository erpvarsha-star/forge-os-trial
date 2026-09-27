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
export function defaultHoursForShift(shiftName: string | null | undefined): number {
  return shiftName === 'General' ? 9 : MIN_WORKING_HOURS
}

// Resolves the hours a day should count as for reporting: the real
// hours_worked if a checkout was recorded, otherwise the shift default
// above. Never returns null/undefined, so a report can sum or average
// this without special-casing missing checkouts.
export function effectiveHoursWorked(hoursWorked: number | null | undefined, shiftName: string | null | undefined): number {
  return typeof hoursWorked === 'number' ? hoursWorked : defaultHoursForShift(shiftName)
}
