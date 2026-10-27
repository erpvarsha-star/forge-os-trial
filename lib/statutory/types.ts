/**
 * Statutory report types. Pure data shapes only (no React, no supabase).
 * A StatRow is ONE employee for ONE pay period, already merged across all
 * non-cancelled runs of that period (see mergeRows in merge.ts).
 *
 * Snapshot fields relied on (pay_run_items.snapshot): earnings{BASIC,CONVEYANCE,
 * EDUCATION,MEDICAL,...}, deductions{PF,ESI,PT,MLWF,...}, worked, totalEarnings,
 * category. Identity (name/UAN/ESI no/gender/pt_exempt) comes from employees and
 * employee_salary_structure, not from the snapshot.
 */
export interface StatRow {
  empCode: string
  name: string
  category?: string | null
  gender?: string | null        // 'female' | 'male' (employees.gender)
  ptExempt?: boolean            // employees.pt_exempt (owner-approved PT exemption list)
  uan?: string | null
  esiNo?: string | null
  worked?: number | null
  earnings?: Record<string, number> | null
  deductions?: Record<string, number> | null
  totalEarnings?: number | null
  /** After-engine extras (recurring allowance, BUNG OT, outstation travel). Included in totalEarnings but NOT statutory wages. */
  extraEarningsTotal?: number | null
}

export const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
/** Wages for statutory reports: totalEarnings minus after-engine extras (owner decision 27 Oct 2026). */
export const statutoryWages = (r: { totalEarnings?: unknown; extraEarningsTotal?: unknown }): number =>
  Math.max(0, num(r.totalEarnings) - num(r.extraEarningsTotal))
export const money = (v: unknown): string => num(v).toFixed(2)
