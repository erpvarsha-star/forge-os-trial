import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { istMonthYear, getMonthEndDay } from '@/lib/istDate'

export interface LateOccurrence {
  date: string
  check_in_time?: string
  late_minutes?: number
}

export interface LateComer {
  employee_id: string
  emp_code: string
  name: string
  department: string
  count: number
  occurrences: LateOccurrence[]
}

export interface HoursOccurrence {
  date: string
  hours_worked: number
}

export interface ShortHoursEmployee {
  employee_id: string
  emp_code: string
  name: string
  department: string
  count: number
  occurrences: HoursOccurrence[]
}

export interface ShiftGroup<T> {
  shiftName: string
  startTime: string | null
  employees: T[]
}

// Minimum occurrence count within the month before an employee shows up on
// either review — chosen by Yash so the screen surfaces only repeat cases
// to review, not every one-off day. Short-hours reuses the same bar since
// none was specified separately.
const LATE_THRESHOLD = 3
const SHORT_HOURS_THRESHOLD = 3

// Yash's numbers, exactly as given: floor below which a day counts as
// short, the same for every shift type (Shift 1/2/3 ~8h with break,
// General 9h, 09:00-18:00) — "min working hrs for each is 8.30 hrs."
const MIN_WORKING_HOURS = 8.5

const UNASSIGNED = 'Unassigned Shift'

// Shared by both reviews: groups a qualifying employee list under whichever
// shift each was on most often this month (rotating departments can change
// week to week), reusing one batch of employee_shifts rows for both.
function groupByShift<T extends { employee_id: string }>(
  qualifying: T[],
  shiftRows: { employee_id: string; shift: { name: string; start_time: string } | null }[]
): ShiftGroup<T>[] {
  const shiftCountByEmployee = new Map<string, Map<string, { name: string; start_time: string; count: number }>>()
  for (const row of shiftRows) {
    if (!row.shift) continue
    const perEmp = shiftCountByEmployee.get(row.employee_id) || new Map()
    const entry = perEmp.get(row.shift.name) || { name: row.shift.name, start_time: row.shift.start_time, count: 0 }
    entry.count += 1
    perEmp.set(row.shift.name, entry)
    shiftCountByEmployee.set(row.employee_id, perEmp)
  }

  const shiftMap = new Map<string, ShiftGroup<T>>()
  for (const emp of qualifying) {
    const perEmp = shiftCountByEmployee.get(emp.employee_id)
    let shiftName = UNASSIGNED
    let startTime: string | null = null
    if (perEmp && perEmp.size > 0) {
      const top = Array.from(perEmp.values()).sort((a, b) => b.count - a.count)[0]
      shiftName = top.name
      startTime = top.start_time
    }
    const group = shiftMap.get(shiftName) || { shiftName, startTime, employees: [] }
    group.employees.push(emp)
    shiftMap.set(shiftName, group)
  }

  const sorted = Array.from(shiftMap.values()).sort((a, b) => {
    if (a.shiftName === UNASSIGNED) return 1
    if (b.shiftName === UNASSIGNED) return -1
    return (a.startTime || '').localeCompare(b.startTime || '')
  })
  for (const g of sorted) g.employees.sort((a, b) => (b as any).count - (a as any).count)
  return sorted
}

export function useLateComers() {
  const current = istMonthYear()
  const [month, setMonth] = useState(current.month)
  const [year, setYear] = useState(current.year)
  const [lateGroups, setLateGroups] = useState<ShiftGroup<LateComer>[]>([])
  const [shortHoursGroups, setShortHoursGroups] = useState<ShiftGroup<ShortHoursEmployee>[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isCurrentMonth = month === current.month && year === current.year

  const goToPrevMonth = () => {
    const m = parseInt(month, 10)
    if (m === 1) { setMonth('12'); setYear(year - 1) } else { setMonth(String(m - 1).padStart(2, '0')) }
  }
  const goToNextMonth = () => {
    if (isCurrentMonth) return
    const m = parseInt(month, 10)
    if (m === 12) { setMonth('01'); setYear(year + 1) } else { setMonth(String(m + 1).padStart(2, '0')) }
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    const startDate = `${year}-${month}-01`
    const endDate = `${year}-${month}-${String(getMonthEndDay(month, year)).padStart(2, '0')}`

    // Not filtered by status — short-hours can happen on a day the employee
    // was never late for check-in, so both reviews need the same full-month
    // row set to compute from.
    const { data: records } = await supabase
      .from('attendance_records')
      .select('employee_id, date, check_in_time, late_minutes, hours_worked, status, employee:employees!employee_id(emp_code, name, department, is_active)')
      .gte('date', startDate)
      .lte('date', endDate)

    const allRecords = (records || []) as any[]

    const lateByEmployee = new Map<string, LateComer>()
    const shortByEmployee = new Map<string, ShortHoursEmployee>()

    for (const r of allRecords) {
      if (!r.employee || r.employee.is_active === false) continue

      if (r.status === 'L' || r.status === 'HL') {
        const occurrence: LateOccurrence = { date: r.date, check_in_time: r.check_in_time, late_minutes: r.late_minutes }
        const existing = lateByEmployee.get(r.employee_id)
        if (existing) {
          existing.count += 1
          existing.occurrences.push(occurrence)
        } else {
          lateByEmployee.set(r.employee_id, {
            employee_id: r.employee_id, emp_code: r.employee.emp_code, name: r.employee.name,
            department: r.employee.department, count: 1, occurrences: [occurrence],
          })
        }
      }

      if (typeof r.hours_worked === 'number' && r.hours_worked < MIN_WORKING_HOURS) {
        const occurrence: HoursOccurrence = { date: r.date, hours_worked: r.hours_worked }
        const existing = shortByEmployee.get(r.employee_id)
        if (existing) {
          existing.count += 1
          existing.occurrences.push(occurrence)
        } else {
          shortByEmployee.set(r.employee_id, {
            employee_id: r.employee_id, emp_code: r.employee.emp_code, name: r.employee.name,
            department: r.employee.department, count: 1, occurrences: [occurrence],
          })
        }
      }
    }

    const qualifyingLate = Array.from(lateByEmployee.values()).filter(e => e.count > LATE_THRESHOLD)
    const qualifyingShort = Array.from(shortByEmployee.values()).filter(e => e.count > SHORT_HOURS_THRESHOLD)

    if (qualifyingLate.length === 0 && qualifyingShort.length === 0) {
      setLateGroups([])
      setShortHoursGroups([])
      setIsLoading(false)
      return
    }

    const employeeIds = Array.from(new Set([
      ...qualifyingLate.map(e => e.employee_id),
      ...qualifyingShort.map(e => e.employee_id),
    ]))
    const { data: shiftRows } = await supabase
      .from('employee_shifts')
      .select('employee_id, date, shift:shifts(name, start_time)')
      .in('employee_id', employeeIds)
      .gte('date', startDate)
      .lte('date', endDate)

    const shiftRowsArr = (shiftRows || []) as any[]
    setLateGroups(groupByShift(qualifyingLate, shiftRowsArr))
    setShortHoursGroups(groupByShift(qualifyingShort, shiftRowsArr))
    setIsLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    month, year, isLoading, goToPrevMonth, goToNextMonth, isCurrentMonth,
    lateGroups, shortHoursGroups,
    lateThreshold: LATE_THRESHOLD, shortHoursThreshold: SHORT_HOURS_THRESHOLD, minWorkingHours: MIN_WORKING_HOURS,
    refresh: fetchData,
  }
}
