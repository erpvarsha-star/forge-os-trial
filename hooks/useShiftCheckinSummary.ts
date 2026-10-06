import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { istDateStr, istYesterdayStr } from '@/lib/istDate'

export type ShiftCheckinPeriod = 'today' | 'yesterday'

export interface ShiftCheckinCell {
  checkIns: number
  checkOuts: number
}

export interface ShiftCheckinRow {
  shiftName: string
  isUnassigned: boolean
  byCategory: Record<string, ShiftCheckinCell>
  total: ShiftCheckinCell
}

export interface ShiftCheckinSummaryData {
  rows: ShiftCheckinRow[]
  grandTotal: ShiftCheckinCell
}

// Fixed row set and order — decided from the 1 Oct 2026 mockup's open
// questions, as Claude's own reasonable default (confirmed by silence, not
// re-asked): Shift 1-5 + General + Unassigned. "Unassigned" (an employee who
// checked in with no employee_shifts row at all for that date) is kept as
// its own row rather than folded into an inferred shift or dropped, matching
// this project's locked "never silently drop people from a denominator"
// rule (CLAUDE.md, "Attendance counting rules"). Security Day/Night are
// deliberately excluded — not in Yash's own "1 2 3 4 5 and General" phrasing
// — with a footnote under the table saying so instead of those check-ins
// just vanishing with no explanation.
const SHIFT_ROW_ORDER = ['Shift 1', 'Shift 2', 'Shift 3', 'Shift 4', 'Shift 5', 'General']
export const UNASSIGNED_ROW = 'Unassigned'
const EXCLUDED_SHIFTS = new Set(['Security Day', 'Security Night'])

// Canonical display order for the 3 currently-live employees.category
// values. Any other value is queried live off the data (never hardcoded as
// a presumed 4th category) and appended alphabetically after these.
const CATEGORY_ORDER = ['worker', 'staff', 'consultant']
export const UNKNOWN_CATEGORY = '__unknown__'

function emptyCell(): ShiftCheckinCell {
  return { checkIns: 0, checkOuts: 0 }
}

function sortCategories(cats: Set<string>): string[] {
  const known = CATEGORY_ORDER.filter(c => cats.has(c))
  const rest = Array.from(cats)
    .filter(c => !CATEGORY_ORDER.includes(c) && c !== UNKNOWN_CATEGORY)
    .sort()
  const unknown = cats.has(UNKNOWN_CATEGORY) ? [UNKNOWN_CATEGORY] : []
  return [...known, ...rest, ...unknown]
}

/**
 * Shift x category check-in/check-out counts for Today and Yesterday
 * (IST calendar dates, via lib/istDate.ts — never a plain `new Date()`).
 *
 * Query shape matches the raw SQL verified live this session:
 *   attendance_records JOIN employees (for category)
 *   LEFT JOIN employee_shifts + shifts ON (employee_id, date) — may be
 *   absent, which is exactly the "Unassigned" row.
 * Implemented as two chained Supabase queries + client-side grouping,
 * following this project's existing pattern (see useLateComers.ts,
 * useShiftAllocation.ts) rather than raw SQL from the app.
 */
export function useShiftCheckinSummary() {
  const [period, setPeriod] = useState<ShiftCheckinPeriod>('today')
  const [dataByDate, setDataByDate] = useState<Record<string, ShiftCheckinSummaryData>>({})
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = istDateStr()
  const yesterday = istYesterdayStr()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [{ data: records, error: recErr }, { data: shiftRows, error: shiftErr }] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('employee_id, date, check_in_time, check_out_time, employee:employees!employee_id(category)')
        .in('date', [today, yesterday]),
      supabase
        .from('employee_shifts')
        .select('employee_id, date, shift:shifts(name)')
        .in('date', [today, yesterday]),
    ])

    if (recErr || shiftErr) {
      setError((recErr || shiftErr)?.message || 'load_failed')
      setIsLoading(false)
      return
    }

    const allRecords = (records || []) as any[]
    const allShiftRows = (shiftRows || []) as any[]

    const shiftByEmpDate = new Map<string, string>()
    for (const row of allShiftRows) {
      if (row.shift?.name) shiftByEmpDate.set(`${row.employee_id}|${row.date}`, row.shift.name)
    }

    // date -> row shift name -> category -> cell
    const buckets = new Map<string, Map<string, Map<string, ShiftCheckinCell>>>([
      [today, new Map()],
      [yesterday, new Map()],
    ])
    const categorySet = new Set<string>()

    for (const r of allRecords) {
      const dateBucket = buckets.get(r.date)
      if (!dateBucket) continue // query is filtered to only these 2 dates

      const assignedShift = shiftByEmpDate.get(`${r.employee_id}|${r.date}`)
      if (assignedShift && EXCLUDED_SHIFTS.has(assignedShift)) continue // security guards — excluded, see footnote

      const rowName = assignedShift && SHIFT_ROW_ORDER.includes(assignedShift) ? assignedShift : UNASSIGNED_ROW

      const category = r.employee?.category || UNKNOWN_CATEGORY
      categorySet.add(category)

      const shiftBucket = dateBucket.get(rowName) || new Map<string, ShiftCheckinCell>()
      const cell = shiftBucket.get(category) || emptyCell()
      if (r.check_in_time) cell.checkIns += 1
      if (r.check_out_time) cell.checkOuts += 1
      shiftBucket.set(category, cell)
      dateBucket.set(rowName, shiftBucket)
    }

    const sortedCategories = sortCategories(categorySet)

    const result: Record<string, ShiftCheckinSummaryData> = {}
    for (const date of [today, yesterday]) {
      const dateBucket = buckets.get(date)!
      const rowNames = [...SHIFT_ROW_ORDER, UNASSIGNED_ROW]
      const rows: ShiftCheckinRow[] = rowNames.map(shiftName => {
        const shiftBucket = dateBucket.get(shiftName)
        const byCategory: Record<string, ShiftCheckinCell> = {}
        const total = emptyCell()
        for (const cat of sortedCategories) {
          const cell = shiftBucket?.get(cat) || emptyCell()
          byCategory[cat] = cell
          total.checkIns += cell.checkIns
          total.checkOuts += cell.checkOuts
        }
        return { shiftName, isUnassigned: shiftName === UNASSIGNED_ROW, byCategory, total }
      })

      const grandTotal = emptyCell()
      for (const row of rows) {
        grandTotal.checkIns += row.total.checkIns
        grandTotal.checkOuts += row.total.checkOuts
      }

      result[date] = { rows, grandTotal }
    }

    setCategories(sortedCategories)
    setDataByDate(result)
    setIsLoading(false)
  }, [today, yesterday])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const date = period === 'today' ? today : yesterday

  return {
    period,
    setPeriod,
    today,
    yesterday,
    date,
    categories,
    data: dataByDate[date],
    isLoading,
    error,
    refresh: fetchData,
  }
}
