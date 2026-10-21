/**
 * Pay-run export builders (pure functions, no I/O).
 * Bank file mirrors the old HR OS salary sheet's column names and order
 * (EMP_ID, EMPLOYEE_NAME, BANK_NAME, BANK_ACCOUNT, IFSC, NET_PAY); no narration.
 * Salary sheet: one row per employee, earnings/deductions columns are the union
 * of keys across all rows. Bank file: net pay per employee with bank details.
 * Tolerant of lean/historical snapshots (missing keys never throw).
 */
// Self-contained on purpose: no supabase import, so it runs under plain tsx.

export interface SalaryRow {
  empCode: string
  name: string
  category?: string | null
  worked?: number | null
  earnings?: Record<string, number> | null
  deductions?: Record<string, number> | null
  totalEarnings?: number | null
  totalDeductions?: number | null
  netPay?: number | null
}

export interface BankRow {
  empCode: string
  name: string
  netPay?: number | null
  bankName?: string | null
  accountNo?: string | null
  ifsc?: string | null
}

const BOM = '﻿'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const money = (v: unknown): string => num(v).toFixed(2)

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralise spreadsheet formula injection on text cells
  const safe = /^[=+@]/.test(s) ? `'${s}` : s
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const line = (cells: unknown[]) => cells.map(csvCell).join(',')
const byCode = <T extends { empCode: string }>(rows: T[]) =>
  [...rows].sort((a, b) => String(a.empCode).localeCompare(String(b.empCode), 'en', { numeric: true }))
const keysOf = (rows: SalaryRow[], f: 'earnings' | 'deductions') =>
  [...new Set(rows.flatMap((r) => Object.keys(r?.[f] ?? {})))].sort()

export function buildSalarySheetCsv(rows: SalaryRow[]): string {
  const list = byCode(rows ?? [])
  const eKeys = keysOf(list, 'earnings')
  const dKeys = keysOf(list, 'deductions')
  const out = [line(['Emp Code', 'Name', 'Category', 'Days Worked', ...eKeys, 'Total Earnings', ...dKeys, 'Total Deductions', 'Net Pay'])]
  for (const r of list) {
    out.push(line([
      r.empCode, r.name, r.category ?? '', r.worked == null ? '' : num(r.worked),
      ...eKeys.map((k) => money(r.earnings?.[k])),
      money(r.totalEarnings),
      ...dKeys.map((k) => money(r.deductions?.[k])),
      money(r.totalDeductions),
      money(r.netPay),
    ]))
  }
  return BOM + out.join('\r\n') + '\r\n'
}

export function buildBankFileCsv(
  rows: BankRow[], month: number, year: number,
): { csv: string; missingBank: string[] } {
  void month; void year // kept for call-site compatibility; the old-sheet layout has no narration
  const list = byCode(rows ?? []).filter((r) => num(r.netPay) > 0)
  const missingBank: string[] = []
  const out = [line(['EMP_ID', 'EMPLOYEE_NAME', 'BANK_NAME', 'BANK_ACCOUNT', 'IFSC', 'NET_PAY'])]
  for (const r of list) {
    if (!r.accountNo || !r.ifsc) missingBank.push(r.empCode)
    out.push(line([r.empCode, r.name, r.bankName ?? '', r.accountNo ?? '', r.ifsc ?? '', money(r.netPay)]))
  }
  return { csv: BOM + out.join('\r\n') + '\r\n', missingBank }
}
