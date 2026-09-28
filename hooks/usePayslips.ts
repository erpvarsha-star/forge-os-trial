import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PayrollRecord } from '@/types'

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

export function usePayslips(employeeId: string | undefined) {
  const [months, setMonths] = useState<PayslipMonth[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchMonths = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    const { data } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'final')

    const byKey = new Map<string, PayrollRecord>()
    for (const row of (data ?? []) as PayrollRecord[]) {
      byKey.set(`${row.year}-${row.month}`, row)
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
    supabase
      .from('payroll_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month', month)
      .eq('year', year)
      .eq('status', 'final')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setRecord(data as PayrollRecord | null)
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [employeeId, month, year])

  return { record, isLoading }
}
