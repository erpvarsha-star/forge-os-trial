// Leave day computation — pure, testable (scripts/leave-form-days.test.ts).
// Mirrors the owner's leave sheet rules:
//   * calendar days between start and end, inclusive
//   * same-day with either half flag -> 0.5
//   * start_half = 'second' -> first day only counts half
//   * end_half   = 'first'  -> last day only counts half
//   * minimum 0.5
export type HalfDay = 'first' | 'second' | null | undefined

export const EXTRA_WORK_MAX = 5

export interface ExtraWorkBlock {
  date: string
  time_from: string
  time_to: string
  hours: number
  details: string
}

export interface LeaveDetail {
  start_half?: HalfDay
  end_half?: HalfDay
  place?: string
  purpose?: string
  time_from?: string
  time_to?: string
  extra_work?: ExtraWorkBlock[]
}

// Normalizes a user-typed date into an unambiguous ISO 'YYYY-MM-DD' string.
//
// Why this exists: Postgres's DateStyle on this project is ISO,MDY. The
// Start/End Date inputs are plain free text with a "YYYY-MM-DD" placeholder,
// but users naturally type the Indian DD/MM/YYYY convention instead (e.g.
// "23/11/2026" for 23 Nov). Sent straight to Postgres, that gets parsed as
// MM/DD/YYYY: a day > 12 throws "date/time field value out of range" (a
// visible crash), but a day <= 12 (e.g. "09/11/2026") parses SILENTLY as the
// wrong date (11 Sep instead of 9 Nov) — no error, just wrong data. This
// helper accepts either a strict ISO string or a D/M/YYYY-style slash string
// (always read as DD/MM, the convention users actually type) and returns the
// unambiguous ISO form, or null if the input isn't one of those two accepted
// shapes or isn't a real calendar date (e.g. 30 Feb, month 13).
export function normalizeDateInput(input: string): string | null {
  if (!input) return null
  const value = input.trim()

  // Strict ISO passthrough: YYYY-MM-DD
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10)
    const d = parseInt(isoMatch[3], 10)
    return isRealCalendarDate(y, m, d) ? isoMatch[0] : null
  }

  // D/M/YYYY or DD/MM/YYYY — the natural convention users type, always read
  // as day-first (never month-first) so "09/11/2026" means 9 Nov, not 11 Sep.
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const d = parseInt(slashMatch[1], 10)
    const m = parseInt(slashMatch[2], 10)
    const y = parseInt(slashMatch[3], 10)
    if (!isRealCalendarDate(y, m, d)) return null
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return null
}

// Robust real-calendar-date check: construct the UTC date and verify it
// round-trips to the same y/m/d (catches Feb 30, month 13, day 32, etc. —
// not just "has the right shape").
function isRealCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function computeDays(startDate: string, endDate: string, startHalf?: HalfDay, endHalf?: HalfDay): number {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0

  if (start.getTime() === end.getTime()) {
    return startHalf || endHalf ? 0.5 : 1
  }

  let days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  if (startHalf === 'second') days -= 0.5
  if (endHalf === 'first') days -= 0.5
  return Math.max(0.5, days)
}

// Hours between two HH:MM strings, for the C-off extra-work blocks.
export function hoursBetween(timeFrom: string, timeTo: string): number {
  const [fh, fm] = timeFrom.split(':').map(Number)
  const [th, tm] = timeTo.split(':').map(Number)
  if (isNaN(fh) || isNaN(fm) || isNaN(th) || isNaN(tm)) return 0
  return Math.max(0, (th * 60 + tm - (fh * 60 + fm)) / 60)
}
