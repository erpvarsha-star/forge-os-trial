import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PayrollRecord } from '@/types'
import type { SlipSnapshot } from '@/lib/payroll/payslipModel'

export interface PayslipMonth {
  month: string // '04'..'12','01'..'03', zero-padded
  year: number
  label: string // 'April 2026'
  issued: boolean
  record: PayrollRecord | null
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April', '05': 'May', '06': 'June',
  '07': 'July', '08': 'August', '09': 'September', '10': 'October', '11': 'November', '12': 'December',
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
// PayrollRecord shape the detail screen and PDF already render. Earnings /
// deductions keys not mapped to a dedicated column fall into other_allowance /
// other_deduction so the totals always equal the snapshot totals.
export function snapshotToRecord(employeeId: string, row: MyPayslipRow): PayrollRecord {
  const s = (row.snapshot ?? {}) as Partial<SlipSnapshot>
  const e = s.earnings ?? {}
  const d = s.deductions ?? {}
  const eMapped: Record<string, keyof PayrollRecord> = {
    BASIC: 'basic', HRA: 'hra', CONVEYANCE: 'conveyance', OT: 'overtime', GROSS: 'basic',
    EDUCATION: 'education', MEDICAL: 'medical', PRO_DEV: 'professional_development',
    COMMUNICATION: 'communication', UNIFORM: 'uniform', WASHING: 'washing', HEAT: 'heat_allowance',
    VDA: 'vda', PROD_ALLOWANCE: 'production_allowance', ARREARS: 'arrears',
  }
  const dMapped: Record<string, keyof PayrollRecord> = {
    PF: 'pf', ESI: 'esic', PT: 'pt', ADVANCE: 'advance_recovery', TDS: 'tds',
    CANTEEN: 'canteen', SOCIETY: 'society', MLWF: 'mlwf',
  }
  const out: Record<string, number> = {}
  let otherAllowance = 0
  for (const [k, v] of Object.entries(e)) {
    const col = eMapped[k]
    if (col) out[col] = (out[col] ?? 0) + n(v)
    else otherAllowance += n(v)
  }
  let otherDeduction = 0
  for (const [k, v] of Object.entries(d)) {
    const col = dMapped[k]
    if (col) out[col] = (out[col] ?? 0) + n(v)
    else otherDeduction += n(v)
  }
  return {
    id: row.pay_run_item_id,
    employee_id: employeeId,
    month: row.month,
    year: Number(row.year),
    basic: 0, hra: 0, conveyance: 0, special_allowance: 0, overtime: 0,
    pf: 0, esic: 0, pt: 0, advance_recovery: 0, tds: 0,
    ...out,
    other_allowance: otherAllowance,
    other_deduction: otherDeduction,
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
          label: `${MONTH_NAMES[month]} ${year}`,
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
    fetchMyPayslips(employeeId).then((rows) => {
      if (cancelled) return
      setRecord(rows.find((r) => r.month === month && r.year === year) ?? null)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [employeeId, month, year])

  return { record, isLoading }
}
