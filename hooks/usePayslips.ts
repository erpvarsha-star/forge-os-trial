import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PayrollRecord } from '@/types'
import type { SlipSnapshot } from '@/lib/payroll/payslipModel'
import type { PayslipExtras } from '@/types'
import { monthLabel } from '@/lib/payslipLayout'

export interface PayslipMonth {
  month: string // '04'..'12','01'..'03', zero-padded
  year: number
  label: string // 'April 2026'
  issued: boolean
  record: PayrollRecord | null
}

// FY2026-27: April 2026 through March 2027 — Yash's explicit instruction was
// to build payslips only from this financial year forward, nothing earlier,
// even though the source sheets carry good history back to 2022.
const FY_MONTHS: { month: string; year: number }[] = [
  { month: '04', year: 2026 }, { month: '05', year: 2026 }, { month: '06', year: 2026 },
  { month: '07', year: 2026 }, { month: '08', year: 2026 }, { month: '09', year: 2026 },
  { month: '10', year: 2026 }, { month: '11', year: 2026 }, { month: '12', year: 2026 },
  { month: '01', year: 2027 }, { month: '02', year: 2027 }, { month: '03', year: 2027 },
]

interface MyPayslipRow {
  pay_run_item_id: string
  month: string
  year: string
  run_status: string
  net_pay: number | string
  snapshot: SlipSnapshot | null
}

const n = (v: unknown) => Number(v ?? 0) || 0

// Adapts a pay_run_items snapshot (via my_payslips RPC, PATCH_95) into the
// PayrollRecord shape. Every snapshot key keeps its own entry in
// earnings_lines / deduction_lines (nothing is folded together; unknown keys
// stay visible in the layout), and the totals are the snapshot's own.
export function snapshotToRecord(employeeId: string, row: MyPayslipRow): PayrollRecord {
  const s = (row.snapshot ?? {}) as Partial<SlipSnapshot>
  const e: Record<string, number> = {}
  const d: Record<string, number> = {}
  for (const [k, v] of Object.entries(s.earnings ?? {})) e[k] = n(v)
  for (const [k, v] of Object.entries(s.deductions ?? {})) d[k] = n(v)
  const eCols: Record<string, keyof PayrollRecord> = {
    BASIC: 'basic', HRA: 'hra', CONVEYANCE: 'conveyance', OT: 'overtime',
    EDUCATION: 'education', MEDICAL: 'medical', PRO_DEV: 'professional_development',
    COMMUNICATION: 'communication', UNIFORM: 'uniform', WASHING: 'washing', HEAT: 'heat_allowance',
    VDA: 'vda', PROD_ALLOWANCE: 'production_allowance', ARREARS: 'arrears',
  }
  const dCols: Record<string, keyof PayrollRecord> = {
    PF: 'pf', ESI: 'esic', PT: 'pt', ADVANCE: 'advance_recovery', TDS: 'tds',
    CANTEEN: 'canteen', SOCIETY: 'society', MLWF: 'mlwf', OTHER: 'other_deduction',
    PROD_OFFSET: 'production_allowance_offset',
  }
  const cols: Record<string, number> = {}
  for (const [k, v] of Object.entries(e)) if (eCols[k]) cols[eCols[k]] = v
  for (const [k, v] of Object.entries(d)) if (dCols[k]) cols[dCols[k]] = v
  return {
    id: row.pay_run_item_id,
    employee_id: employeeId,
    month: row.month,
    year: Number(row.year),
    basic: 0, hra: 0, conveyance: 0, special_allowance: 0, overtime: 0,
    pf: 0, esic: 0, pt: 0, advance_recovery: 0, tds: 0,
    ...cols,
    earnings_lines: e,
    deduction_lines: d,
    category: s.category,
    total_earnings: s.totalEarnings !== undefined ? n(s.totalEarnings) : undefined,
    total_deductions: s.totalDeductions !== undefined ? n(s.totalDeductions) : undefined,
    net_pay: n(row.net_pay),
    created_at: '',
    status: 'final',
    days_payable: s.worked,
    ot_hours: s.otHours,
  } as PayrollRecord
}

async function fetchMyPayslips(employeeId: string): Promise<PayrollRecord[]> {
  const { data, error } = await supabase.rpc('my_payslips')
  if (error) return []
  return ((data ?? []) as MyPayslipRow[]).map((r) => snapshotToRecord(employeeId, r))
}

async function fetchExtras(year: number, month: number): Promise<PayslipExtras | null> {
  try {
    const { data, error } = await supabase.rpc('my_payslip_extras', { p_year: year, p_month: month })
    if (error || !data || typeof data !== 'object') return null
    return data as PayslipExtras
  } catch {
    return null
  }
}

export function usePayslips(employeeId: string | undefined) {
  const [months, setMonths] = useState<PayslipMonth[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMonths = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    const rows = await fetchMyPayslips(employeeId)

    const byKey = new Map<string, PayrollRecord>()
    for (const row of rows) {
      const key = `${row.year}-${row.month}`
      if (!byKey.has(key)) byKey.set(key, row)
    }

    setMonths(
      FY_MONTHS.map(({ month, year }) => {
        const record = byKey.get(`${year}-${month}`) ?? null
        return {
          month,
          year,
          label: monthLabel(month, year),
          issued: record !== null,
          record,
        }
      })
    )
    setIsLoading(false)
  }, [employeeId])

  useEffect(() => {
    fetchMonths()
  }, [fetchMonths])

  return { months, isLoading, refresh: fetchMonths }
}

export function usePayslip(employeeId: string | undefined, month: string, year: number) {
  const [record, setRecord] = useState<PayrollRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return
    let cancelled = false
    setIsLoading(true)
    fetchMyPayslips(employeeId).then(async (rows) => {
      const found = rows.find((r) => r.month === month && r.year === year) ?? null
      // Extras (identity, attendance, IDs, leave balances) are best-effort:
      // any failure leaves the snapshot-only payslip intact.
      const extras = found ? await fetchExtras(year, Number(month)) : null
      if (cancelled) return
      setRecord(found ? { ...found, extras } : null)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [employeeId, month, year])

  return { record, isLoading }
}
