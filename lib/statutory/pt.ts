import { StatRow, num } from './types'
import { csvCell } from '../payroll/exportCsv'

const BOM = '﻿'
export const PT_WOMEN_EXEMPT_UPTO = 25000

/**
 * Maharashtra professional tax slab on monthly gross.
 * 0 up to 7,500; 175 for 7,501-10,000; 200 above (300 in February).
 * Women are exempt up to 25,000 gross; explicitly exempt employees pay 0.
 */
export function expectedPt(gross: number, month: number, female: boolean, exempt = false): number {
  const g = num(gross)
  if (exempt) return 0
  if (female && g <= PT_WOMEN_EXEMPT_UPTO) return 0
  if (g <= 7500) return 0
  if (g <= 10000) return 175
  return month === 2 ? 300 : 200
}

export interface PtRow {
  empCode: string
  name: string
  gross: number
  pt: number
  expected: number
  mismatch: boolean
}

export interface PtResult {
  rows: PtRow[]
  mismatches: string[]
  totals: { pt: number; expected: number; members: number }
  csv: string
}

export function buildPt(rows: StatRow[], month: number): PtResult {
  const out: PtRow[] = []
  for (const r of rows ?? []) {
    const pt = num(r.deductions?.PT)
    const gross = num(r.totalEarnings)
    const female = String(r.gender ?? '').toLowerCase().startsWith('f')
    // Consultants carry no statutory deductions; skip anyone with no PT and no expected PT.
    const expected = String(r.category ?? '') === 'CONSULTANT' ? 0 : expectedPt(gross, month, female, !!r.ptExempt)
    if (pt === 0 && expected === 0) continue
    out.push({ empCode: r.empCode, name: r.name, gross, pt, expected, mismatch: Math.round(pt) !== expected })
  }
  const totals = { pt: out.reduce((a, e) => a + e.pt, 0), expected: out.reduce((a, e) => a + e.expected, 0), members: out.length }
  const line = (c: unknown[]) => c.map(csvCell).join(',')
  const lines = [line(['Emp Code', 'Name', 'Gross', 'PT Deducted', 'Expected PT', 'Mismatch'])]
  for (const e of out) lines.push(line([e.empCode, e.name, e.gross.toFixed(2), e.pt.toFixed(2), e.expected.toFixed(2), e.mismatch ? 'MISMATCH' : '']))
  lines.push(line(['TOTAL', '', '', totals.pt.toFixed(2), totals.expected.toFixed(2), String(out.filter((e) => e.mismatch).length)]))
  return { rows: out, mismatches: out.filter((e) => e.mismatch).map((e) => e.empCode), totals, csv: BOM + lines.join('\r\n') + '\r\n' }
}
