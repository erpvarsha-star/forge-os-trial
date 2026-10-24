import { StatRow, num } from './types'
import { csvCell } from '../payroll/exportCsv'

const BOM = '﻿'

/** Maharashtra Labour Welfare Fund is payable half-yearly: June and December only. */
export const isMlwfMonth = (month: number): boolean => month === 6 || month === 12

/** Months covered by the half-year ending in `month` (6 -> 1..6, 12 -> 7..12); [] when not a payable month. */
export function mlwfHalfYearMonths(month: number): number[] {
  if (month === 6) return [1, 2, 3, 4, 5, 6]
  if (month === 12) return [7, 8, 9, 10, 11, 12]
  return []
}

export interface MlwfRow { empCode: string; name: string; byMonth: Record<number, number>; total: number }
export interface MlwfResult {
  payable: boolean
  rows: MlwfRow[]
  totals: { amount: number; members: number }
  csv: string
}

/** monthly: month number -> merged rows of that month (only months with a finalized run). */
export function buildMlwf(monthly: Record<number, StatRow[]>, payableMonth: number): MlwfResult {
  const months = mlwfHalfYearMonths(payableMonth)
  const map = new Map<string, MlwfRow>()
  for (const m of months) {
    for (const r of monthly?.[m] ?? []) {
      const amt = num(r.deductions?.MLWF)
      if (amt <= 0) continue
      const cur = map.get(r.empCode) ?? { empCode: r.empCode, name: r.name, byMonth: {}, total: 0 }
      cur.byMonth[m] = (cur.byMonth[m] ?? 0) + amt
      cur.total += amt
      map.set(r.empCode, cur)
    }
  }
  const rows = [...map.values()].sort((a, b) => a.empCode.localeCompare(b.empCode, 'en', { numeric: true }))
  const line = (c: unknown[]) => c.map(csvCell).join(',')
  const lines = [line(['Emp Code', 'Name', ...months.map((m) => `M${m}`), 'Total'])]
  for (const r of rows) lines.push(line([r.empCode, r.name, ...months.map((m) => (r.byMonth[m] ?? 0).toFixed(2)), r.total.toFixed(2)]))
  const amount = rows.reduce((a, r) => a + r.total, 0)
  lines.push(line(['TOTAL', '', ...months.map(() => ''), amount.toFixed(2)]))
  return { payable: isMlwfMonth(payableMonth), rows, totals: { amount, members: rows.length }, csv: BOM + lines.join('\r\n') + '\r\n' }
}
