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
}

export interface RunSummary {
  employees: number
  gross: number
  net: number
  arrearsSep2630: number
  byCategory: Record<string, { count: number; gross: number; net: number }>
}

export async function payrollRun<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payroll-run', { body: { action, ...payload } })
  if (error) throw new Error(error.message)
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
