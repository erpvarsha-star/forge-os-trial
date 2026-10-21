/**
 * App-side client for the payroll-run edge function.
 * Actions: create | calculate | transition | arrears_sep26_30 | summary
 * Engine math lives in lib/payroll/engine.ts (frozen) — this file only talks to the API.
 */
import { supabase } from '@/lib/supabase'

export interface CalculateResult {
  ok: boolean
  calculated: number
  held: { empCode: string; blockers: string[] }[]
  warnings: string[]
  blockedEmployees: { empCode: string; reason: string }[]
  reconciliation: { empCode: string; date: string; adminStatus: string; mismatch: string }[]
  // Added with top-up runs / monthly VDA rate
  vdaRatePerDay?: number | null
  topup?: boolean
  skippedAlreadyPaid?: number
}

export interface AdvanceRecovery {
  recovered_total: number
  employees: number
  unmatched: unknown[]
}

export interface TransitionResult {
  ok?: boolean
  status?: string
  // Only present when transitioning to 'finalized'
  advanceRecovery?: AdvanceRecovery
}

export interface TopupResult {
  payRunId: string
  parentRunId: string
  status: string
}

// The server answers calculate with HTTP 422 + this message when no VDA rate is entered for the month.
export const VDA_RATE_MISSING_ERROR = 'monthly VDA rate not entered'

export interface RunSummary {
  employees: number
  gross: number
  net: number
  arrearsSep2630: number
  byCategory: Record<string, { count: number; gross: number; net: number }>
}

export interface ExportSalaryRow {
  empCode: string
  name: string
  category: string | null
  worked: number | null
  earnings: Record<string, number>
  deductions: Record<string, number>
  totalEarnings: number
  totalDeductions: number
  netPay: number
}

export interface ExportBankRow {
  empCode: string
  name: string
  netPay: number
  bankName: string | null
  accountNo: string | null
  ifsc: string | null
}

export interface PayRunExport {
  month: number
  year: number
  runName: string
  salaryRows: ExportSalaryRow[]
  bankRows: ExportBankRow[]
}

export async function payrollRun<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payroll-run', { body: { action, ...payload } })
  if (error) {
    // supabase-js returns FunctionsHttpError for any non-2xx; the JSON body (e.g. 422 {error, hint}) is on error.context
    let body: any = null
    try { body = await (error as any).context?.json?.() } catch { body = null }
    if (body && typeof body.error === 'string') {
      const err: any = new Error(body.error)
      err.detail = body
      throw err
    }
    throw new Error(error.message)
  }
  if (data?.error) {
    const err: any = new Error(data.error)
    err.detail = data
    throw err
  }
  return data as T
}

export const PAYROLL_MONTH_LABEL = (month: number, year: number) => {
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${names[month - 1]} ${year}`
}

export const exportPayRun = (payRunId: string) => payrollRun<PayRunExport>('export', { payRunId })

export const createTopupRun = (parentRunId: string) => payrollRun<TopupResult>('create_topup', { parentRunId })

export const transitionRun = (payRunId: string, to: string) =>
  payrollRun<TransitionResult>('transition', { payRunId, to })
