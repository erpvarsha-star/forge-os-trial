import { StatRow, num, statutoryWages } from './types'

/** EPFO constants. */
export const PF_WAGE_CEILING = 15000
export const EPF_RATE = 0.12
export const EPS_RATE = 0.0833 // 8.33%
export const ECR_SEP = '#~#'

// All PF/EPS amounts are rounded to the NEAREST rupee (half up), the EPFO convention.
const rnd = (n: number) => Math.round(n + 1e-9)

export interface EcrRow {
  empCode: string
  uan: string
  name: string
  grossWages: number
  epfWages: number
  epsWages: number
  edliWages: number
  epfEe: number
  eps: number
  epfEpsDiff: number
  ncpDays: number
  refundAdvances: number
  /** true when the PF actually deducted differs from 12% of the PF wage (beyond the wage-ceiling case). */
  pfMismatch: boolean
}

export interface EcrResult {
  rows: EcrRow[]
  /** Members with a PF deduction but no UAN: NOT written to the ECR, surfaced on screen. */
  missingUan: string[]
  /** Employees without a PF deduction (not PF-covered this period). */
  notCovered: number
  mismatches: string[]
  totals: { gross: number; epfWages: number; epfEe: number; eps: number; diff: number; members: number }
  text: string
}

/** PF wage = BASIC + CONVEYANCE + EDUCATION + MEDICAL earned in the month (same base as the payroll engine's staff PF). */
export function pfWageOf(earnings?: Record<string, number> | null): number {
  const e = earnings ?? {}
  return num(e.BASIC) + num(e.CONVEYANCE) + num(e.EDUCATION) + num(e.MEDICAL)
}

const DAYS_BY_CAT_CALENDAR = ['STAFF', 'PUNE_STAFF', 'CONSULTANT']

/**
 * NCP (non-contributory) days. ASSUMPTION: the snapshot has days worked (`worked`) but not
 * the period's working days. For salaried categories (STAFF / PUNE_STAFF / CONSULTANT) the
 * engine pays on calendar days, so NCP = max(0, calendar days - worked). For PERMANENT_WORKER the
 * working-day basis excludes site weekly-offs and is not derivable here, so NCP = 0.
 */
export function ncpDaysFor(category: string | null | undefined, worked: number, daysInMonth: number): number {
  if (!DAYS_BY_CAT_CALENDAR.includes(String(category ?? ''))) return 0
  return Math.max(0, Math.round(daysInMonth - num(worked)))
}

export function ecrRowFor(r: StatRow, daysInMonth: number): EcrRow {
  const pfWage = Math.round(pfWageOf(r.earnings))
  const deducted = rnd(num(r.deductions?.PF))
  // EPF wages = PF wage. If the payroll capped PF at the 15,000 ceiling (e.g. flat 1,800 for workers
  // paid above the ceiling), report the capped wage so the ECR agrees with what was actually deducted.
  let epfWages = pfWage
  let pfMismatch = false
  if (Math.abs(deducted - rnd(EPF_RATE * pfWage)) > 1) {
    const capped = Math.min(pfWage, PF_WAGE_CEILING)
    if (Math.abs(deducted - rnd(EPF_RATE * capped)) <= 1) epfWages = capped
    else pfMismatch = true
  }
  const epsWages = Math.min(pfWage, PF_WAGE_CEILING)
  const eps = rnd(EPS_RATE * epsWages)
  // EE share = the PF actually withheld. Employer EPF total mirrors the employee's 12%, so
  // ER share (EPF-EPS diff) = EE contribution - EPS.
  const epfEe = deducted
  return {
    empCode: r.empCode,
    uan: String(r.uan ?? ''),
    name: r.name,
    grossWages: rnd(statutoryWages(r)),
    epfWages,
    epsWages,
    edliWages: epsWages,
    epfEe,
    eps,
    epfEpsDiff: epfEe - eps,
    ncpDays: ncpDaysFor(r.category, num(r.worked), daysInMonth),
    refundAdvances: 0,
    pfMismatch,
  }
}

/** One ECR 2.0 text line, exact column order, '#~#' separator, no header. */
export function ecrLine(e: EcrRow): string {
  return [
    e.uan, e.name.replace(/#~#/g, ' ').replace(/[\r\n]+/g, ' ').trim(), e.grossWages, e.epfWages, e.epsWages, e.edliWages,
    e.epfEe, e.eps, e.epfEpsDiff, e.ncpDays, e.refundAdvances,
  ].join(ECR_SEP)
}

export function buildPfEcr(rows: StatRow[], daysInMonth: number): EcrResult {
  const out: EcrRow[] = []
  const missingUan: string[] = []
  const mismatches: string[] = []
  let notCovered = 0
  for (const r of rows ?? []) {
    if (num(r.deductions?.PF) <= 0) { notCovered++; continue }
    if (!String(r.uan ?? '').trim()) { missingUan.push(r.empCode); continue }
    const e = ecrRowFor(r, daysInMonth)
    if (e.pfMismatch) mismatches.push(r.empCode)
    out.push(e)
  }
  const sum = (f: (e: EcrRow) => number) => out.reduce((a, e) => a + f(e), 0)
  return {
    rows: out,
    missingUan,
    notCovered,
    mismatches,
    totals: { gross: sum((e) => e.grossWages), epfWages: sum((e) => e.epfWages), epfEe: sum((e) => e.epfEe), eps: sum((e) => e.eps), diff: sum((e) => e.epfEpsDiff), members: out.length },
    text: out.map(ecrLine).join('\r\n') + (out.length ? '\r\n' : ''),
  }
}
