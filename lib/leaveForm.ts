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
