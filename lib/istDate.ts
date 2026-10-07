// IST (Indian Standard Time, UTC+5:30) date utilities
// Critical for attendance, payroll, and reporting — all queries use IST dates

export const istDateStr = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

// Yesterday's IST calendar date — same offset trick as istDateStr(), just
// one more day subtracted before the UTC-reinterpretation. Added for the
// Shift Check-in Summary's Today/Yesterday toggle; use this instead of a
// one-off `new Date(Date.now() - 86400000)` anywhere else that needs it.
export const istYesterdayStr = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

// Date an attendance/shift row is filed under. Shift 3 (00:00–07:00) belongs to
// the previous working day (Yash, 28 Sep 2026), so the day rolls over at 06:45 IST
// — Shift 1's start minus the 15-min shift-matching buffer.
export const attendanceDateStr = () =>
  new Date(Date.now() + (5.5 - 6.75) * 60 * 60 * 1000).toISOString().slice(0, 10)

// Minutes late against a shift start (HH:MM), handling midnight wraparound.
// More than 12h "late" means the check-in is actually early for that start.
export const lateMinutesAgainst = (startTime: string) => {
  const [h, m] = startTime.split(':').map(Number)
  const now = istNow()
  const diff = (now.getUTCHours() * 60 + now.getUTCMinutes() - (h * 60 + m) + 1440) % 1440
  return diff > 720 ? 0 : diff
}

export const istNow = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000)

export const istMonthYear = () => {
  const istDate = istNow()
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0')
  const year = istDate.getUTCFullYear()
  return { month, year }
}

// Returns the last day of the given month (28-31)
export const getMonthEndDay = (month: string | number, year: number): number => {
  const m = typeof month === 'string' ? parseInt(month, 10) : month
  if ([1, 3, 5, 7, 8, 10, 12].includes(m)) return 31
  if ([4, 6, 9, 11].includes(m)) return 30
  if (m === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return 31
}

// Returns the UTC ISO timestamp for IST midnight of the given YYYY-MM-DD date.
// Needed whenever filtering a timestamptz column (e.g. created_at) by an IST
// calendar day — a bare "YYYY-MM-DDT00:00:00" is ambiguous/wrong without the
// +05:30 offset, since Postgres would otherwise read it as UTC midnight,
// 5.5 hours before the actual IST day starts.
export const istStartOfDayUTC = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00+05:30`).toISOString()
