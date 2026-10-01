import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type CheckinCategory = 'worker' | 'staff' | 'consultant' | 'other'

export const CHECKIN_CATEGORIES: CheckinCategory[] = ['worker', 'staff', 'consultant', 'other']

export interface CheckinCell {
  in: number
  out: number
  /** Checked in but not yet checked out. */
  stillIn: number
}

export interface CheckinMatrixRow {
  shiftName: string
  startTime: string | null
  byCategory: Record<CheckinCategory, CheckinCell>
  total: CheckinCell
}

const emptyCell = (): CheckinCell => ({ in: 0, out: 0, stillIn: 0 })
const emptyByCategory = (): Record<CheckinCategory, CheckinCell> => ({
  worker: emptyCell(), staff: emptyCell(), consultant: emptyCell(), other: emptyCell(),
})

const UNASSIGNED = 'Unassigned'

// Mirrors lib/istDate.ts's attendanceDateStr() — the working day rolls over
// at 06:45 IST (Shift 1 start minus the 15-min shift-matching buffer), not
// at IST midnight, because Shift 3 (00:00-07:00) is filed under the
// PREVIOUS working day (decision from Yash, 28 Sep 2026 — see CLAUDE.md
// "Shift 3 belongs to the previous working day"). A plain IST-midnight
// toggle would show an incomplete Shift 3 row until 06:45 every morning.
function businessDateNDaysAgo(daysAgo: number): string {
  const d = new Date(Date.now() + (5.5 - 6.75) * 60 * 60 * 1000)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export function useShiftCheckinSummary() {
  const [daysAgo, setDaysAgo] = useState<0 | 1>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [rows, setRows] = useState<CheckinMatrixRow[]>([])
  const [totals, setTotals] = useState<{ totalIn: number; totalOut: number; stillCheckedIn: number; byCategory: Record<CheckinCategory, CheckinCell> }>({
    totalIn: 0, totalOut: 0, stillCheckedIn: 0, byCategory: emptyByCategory(),
  })

  const date = businessDateNDaysAgo(daysAgo)

  const fetchData = useCallback(async () => {
    setIsLoading(true)

    const [{ data: records }, { data: shiftRows }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('employee_id, check_in_time, check_out_time, employee:employees!employee_id(category, is_active)')
        .eq('date', date)
        .not('check_in_time', 'is', null),
      supabase
        .from('employee_shifts')
        .select('employee_id, shift:shifts(name, start_time)')
        .eq('date', date),
    ])

    const shiftByEmployee = new Map<string, { name: string; start_time: string }>()
    for (const r of (shiftRows || []) as any[]) {
      if (r.shift) shiftByEmployee.set(r.employee_id, r.shift)
    }

    const rowMap = new Map<string, CheckinMatrixRow>()
    const byCategory = emptyByCategory()
    let totalIn = 0
    let totalOut = 0

    for (const r of (records || []) as any[]) {
      // A deactivated employee's historical row can still exist for this
      // date — same "never silently drop, but don't count departed people
      // as currently at work" judgment call as the rest of this app's
      // attendance counting (see CLAUDE.md "Attendance counting rules").
      if (!r.employee || r.employee.is_active === false) continue

      const rawCategory = r.employee.category as string
      const category: CheckinCategory = (CHECKIN_CATEGORIES as string[]).includes(rawCategory)
        ? (rawCategory as CheckinCategory)
        : 'other'

      const shift = shiftByEmployee.get(r.employee_id)
      const shiftName = shift?.name ?? UNASSIGNED
      const startTime = shift?.start_time ?? null
      const checkedOut = !!r.check_out_time

      const row = rowMap.get(shiftName) ?? { shiftName, startTime, byCategory: emptyByCategory(), total: emptyCell() }
      const cell = row.byCategory[category]
      cell.in += 1
      row.total.in += 1
      byCategory[category].in += 1
      totalIn += 1
      if (checkedOut) {
        cell.out += 1
        row.total.out += 1
        byCategory[category].out += 1
        totalOut += 1
      } else {
        cell.stillIn += 1
        row.total.stillIn += 1
        byCategory[category].stillIn += 1
      }
      rowMap.set(shiftName, row)
    }

    const sortedRows = Array.from(rowMap.values()).sort((a, b) => {
      if (a.shiftName === UNASSIGNED) return 1
      if (b.shiftName === UNASSIGNED) return -1
      const byStart = (a.startTime || '').localeCompare(b.startTime || '')
      return byStart !== 0 ? byStart : a.shiftName.localeCompare(b.shiftName)
    })

    setRows(sortedRows)
    setTotals({ totalIn, totalOut, stillCheckedIn: totalIn - totalOut, byCategory })
    setIsLoading(false)
  }, [date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    date,
    isToday: daysAgo === 0,
    showYesterday: () => setDaysAgo(1),
    showToday: () => setDaysAgo(0),
    isLoading,
    rows,
    ...totals,
    refresh: fetchData,
  }
}
