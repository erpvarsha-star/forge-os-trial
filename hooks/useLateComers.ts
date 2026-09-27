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

export interface ShiftGroup {
  shiftName: string
  startTime: string | null
  employees: LateComer[]
}

// Minimum late count within the month before an employee shows up on this
// review — chosen by Yash so the screen surfaces only repeat latecomers to
// review, not every one-off late day.
const LATE_THRESHOLD = 3

export function useLateComers() {
  const current = istMonthYear()
  const [month, setMonth] = useState(current.month)
  const [year, setYear] = useState(current.year)
  const [groups, setGroups] = useState<ShiftGroup[]>([])
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

    const { data: records } = await supabase
      .from('attendance_records')
      .select('employee_id, date, check_in_time, late_minutes, employee:employees!employee_id(emp_code, name, department, is_active)')
      .gte('date', startDate)
      .lte('date', endDate)
      .in('status', ['L', 'HL'])

    if (!records || records.length === 0) {
      setGroups([])
      setIsLoading(false)
      return
    }

    const byEmployee = new Map<string, LateComer>()
    for (const r of records as any[]) {
      if (!r.employee || r.employee.is_active === false) continue
      const existing = byEmployee.get(r.employee_id)
      const occurrence: LateOccurrence = { date: r.date, check_in_time: r.check_in_time, late_minutes: r.late_minutes }
      if (existing) {
        existing.count += 1
        existing.occurrences.push(occurrence)
      } else {
        byEmployee.set(r.employee_id, {
          employee_id: r.employee_id,
          emp_code: r.employee.emp_code,
          name: r.employee.name,
          department: r.employee.department,
          count: 1,
          occurrences: [occurrence],
        })
      }
    }

    const qualifying = Array.from(byEmployee.values()).filter(e => e.count > LATE_THRESHOLD)

    if (qualifying.length === 0) {
      setGroups([])
      setIsLoading(false)
      return
    }

    const employeeIds = qualifying.map(e => e.employee_id)
    const { data: shiftRows } = await supabase
      .from('employee_shifts')
      .select('employee_id, date, shift:shifts(name, start_time)')
      .in('employee_id', employeeIds)
      .gte('date', startDate)
      .lte('date', endDate)

    // Group each qualifying employee under whichever shift they were on most
    // often this month (rotating departments can change week to week).
    const shiftCountByEmployee = new Map<string, Map<string, { name: string; start_time: string; count: number }>>()
    for (const row of (shiftRows as any[]) || []) {
      if (!row.shift) continue
      const key = row.shift.name as string
      const perEmp = shiftCountByEmployee.get(row.employee_id) || new Map()
      const entry = perEmp.get(key) || { name: row.shift.name, start_time: row.shift.start_time, count: 0 }
      entry.count += 1
      perEmp.set(key, entry)
      shiftCountByEmployee.set(row.employee_id, perEmp)
    }

    const shiftMap = new Map<string, ShiftGroup>()
    const UNASSIGNED = 'Unassigned Shift'
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

    const sortedGroups = Array.from(shiftMap.values()).sort((a, b) => {
      if (a.shiftName === UNASSIGNED) return 1
      if (b.shiftName === UNASSIGNED) return -1
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
    for (const g of sortedGroups) g.employees.sort((a, b) => b.count - a.count)

    setGroups(sortedGroups)
    setIsLoading(false)
  }, [month, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { month, year, groups, isLoading, goToPrevMonth, goToNextMonth, isCurrentMonth, threshold: LATE_THRESHOLD, refresh: fetchData }
}
