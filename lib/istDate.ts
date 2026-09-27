// IST (Indian Standard Time, UTC+5:30) date utilities
// Critical for attendance, payroll, and reporting — all queries use IST dates

export const istDateStr = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

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
