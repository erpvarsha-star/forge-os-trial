import { StatRow, num, statutoryWages } from './types'
import { csvCell } from '../payroll/exportCsv'

export const ESI_WAGE_CEILING = 21000
export const ESI_EE_RATE_BP = 75    // 0.75% in basis-points-of-percent: wages * 75 / 10000 (basis points = percent x 100)
export const ESI_ER_RATE_BP = 325   // 3.25%
const BOM = '﻿'

/** ESI eligibility on the monthly (fixed) gross: covered when gross <= 21,000. */
export const isEsiEligible = (monthlyGross: number): boolean => num(monthlyGross) <= ESI_WAGE_CEILING

/**
 * ESIC convention: contributions are rounded UP to the next rupee (ceil).
 * Done in integer paise so e.g. 20000 * 0.75% is exactly 150, never 150.00000000000003 -> 151.
 */
export function esiContribution(wages: number, rateBp: number): number {
  const paise = Math.round(num(wages) * 100)
  return Math.ceil((paise * rateBp) / 1000000 - 1e-9)
}

export interface EsiRow {
  empCode: string
  ipNumber: string
  ipName: string
  days: number
  wages: number
  ipContribution: number
  erContribution: number
}

export interface EsiResult {
  rows: EsiRow[]
  missingEsiNo: string[]
  totals: { wages: number; ip: number; er: number; members: number }
  csv: string
}

/** Covered = an ESI deduction > 0 in the snapshot (the engine only deducts when fixed gross <= 21,000). */
export function buildEsi(rows: StatRow[]): EsiResult {
  const out: EsiRow[] = []
  const missingEsiNo: string[] = []
  for (const r of rows ?? []) {
    if (num(r.deductions?.ESI) <= 0) continue
    if (!String(r.esiNo ?? '').trim()) { missingEsiNo.push(r.empCode); continue }
    const wages = Math.round(statutoryWages(r))
    out.push({
      empCode: r.empCode,
      ipNumber: String(r.esiNo),
      ipName: r.name,
      days: Math.round(num(r.worked)),
      wages,
      ipContribution: esiContribution(wages, ESI_EE_RATE_BP),
      erContribution: esiContribution(wages, ESI_ER_RATE_BP),
    })
  }
  const sum = (f: (e: EsiRow) => number) => out.reduce((a, e) => a + f(e), 0)
  const line = (c: unknown[]) => c.map(csvCell).join(',')
  const lines = [line(['IP Number', 'IP Name', 'No of Days', 'Total Monthly Wages', 'Reason Code', 'Last Working Day', 'IP Contribution', 'Employer Contribution'])]
  for (const e of out) lines.push(line([e.ipNumber, e.ipName, e.days, e.wages, '', '', e.ipContribution, e.erContribution]))
  return {
    rows: out,
    missingEsiNo,
    totals: { wages: sum((e) => e.wages), ip: sum((e) => e.ipContribution), er: sum((e) => e.erContribution), members: out.length },
    csv: BOM + lines.join('\r\n') + '\r\n',
  }
}
