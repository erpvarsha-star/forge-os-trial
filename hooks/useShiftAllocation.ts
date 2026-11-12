import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Shift } from '@/types'
import { istDateStr } from '@/lib/istDate'

// Same Sat-Thu work-week math as app/(hr-admin)/shifts.tsx's getWeekStartIST/
// getWeekDays — kept in sync by hand since this is a small, self-contained
// calculation, not worth a shared util for two call sites.
const getWeekStartIST = (weekOffset: number): string => {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000
  const istNow = new Date(istMs)
  const dow = istNow.getUTCDay()
  const daysBack = (dow - 6 + 7) % 7
  const satMs = istMs - daysBack * 86_400_000 + weekOffset * 7 * 86_400_000
  return new Date(satMs).toISOString().slice(0, 10)
}

const getWeekDays = (weekStart: string): string[] => {
  const days: string[] = []
  const base = new Date(weekStart + 'T00:00:00Z')
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getTime() + i * 86_400_000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

// IST calendar date `days` after today, as YYYY-MM-DD — same convention as
// components/AssignTaskModal.tsx's istPlusDays(), kept as its own small copy
// here rather than a shared util for two call sites.
const istPlusDays = (days: number): string => {
  const [y, m, d] = istDateStr().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export interface ShiftAllocationTeamMember {
  id: string
  emp_code: string
  name: string
}

// Shift 1/2/3/4/5/General — no Security options, since no security guard
// in the CSV that drove this feature has an allocator outside HR's own
// group (HR keeps using the existing, unscoped app/(hr-admin)/shifts.tsx).
// Shift 4 (07:00-19:00, PATCH_64) and Shift 5 (19:00-07:00, PATCH_63),
// both 29 Sep 2026, are the day/night OT variants of Shift 1/Shift 3 —
// allocators pick them week-by-week for people doing that OT pattern,
// coexisting with Shift 1/3, not replacing them.
const ALLOCATABLE_SHIFT_NAMES = ['General', 'Shift 1', 'Shift 2', 'Shift 3', 'Shift 4', 'Shift 5']

export type ShiftAllocationMode = 'weekly' | 'daily'

// PATCH_135, 12 Nov 2026 — VFL1560/VFL1566 want to allocate daily instead of
// weekly; every other allocator keeps the existing week-grid flow untouched.
// `mode` comes from the caller's own employees.shift_allocation_mode (the
// Employee row useAuth() already loads with select('*')), not re-queried
// here — this hook just branches its data-loading/saving on it.
export function useShiftAllocation(allocatorId: string | undefined, mode: ShiftAllocationMode = 'weekly') {
  const [weekOffset, setWeekOffset] = useState(0)
  // Daily mode only: how many IST days from today the picked date is.
  // Defaults to tomorrow (1), per Yash's "they chose the date and day of
  // the week they are alloting" — a free +/- stepper, no date-picker lib.
  const [dayOffset, setDayOffset] = useState(1)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [team, setTeam] = useState<ShiftAllocationTeamMember[]>([])
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const weekStart = getWeekStartIST(weekOffset)
  const weekDays = getWeekDays(weekStart)
  const date = istPlusDays(dayOffset)
  // The one date whose employee_shifts rows this load/save cycle targets —
  // the week's Saturday in weekly mode, the picked single day in daily mode.
  const activeDate = mode === 'daily' ? date : weekStart

  const loadData = useCallback(async () => {
    if (!allocatorId) return
    setIsLoading(true)

    const [{ data: sData }, { data: eData }, { data: assignData }] = await Promise.all([
      supabase.from('shifts').select('*').order('start_time'),
      supabase
        .from('employees')
        .select('id, emp_code, name')
        .eq('is_active', true)
        .eq('shift_allocator_id', allocatorId)
        .order('name'),
      supabase
        .from('employee_shifts')
        .select('employee_id, shift_id')
        .eq('date', activeDate),
    ])

    if (sData) setShifts((sData as Shift[]).filter(s => ALLOCATABLE_SHIFT_NAMES.includes(s.name)))
    if (eData) setTeam(eData as ShiftAllocationTeamMember[])

    if (assignData) {
      const teamIds = new Set((eData || []).map((e: { id: string }) => e.id))
      const sel: Record<string, string> = {}
      assignData.forEach((row: { employee_id: string; shift_id: string }) => {
        if (teamIds.has(row.employee_id)) sel[row.employee_id] = row.shift_id
      })
      setSelections(sel)
    }

    setIsLoading(false)
  }, [allocatorId, activeDate])

  useEffect(() => { loadData() }, [loadData])

  const select = (employeeId: string, shiftId: string) => {
    setSelections(prev => {
      if (prev[employeeId] === shiftId) {
        const next = { ...prev }
        delete next[employeeId]
        return next
      }
      return { ...prev, [employeeId]: shiftId }
    })
  }

  // One allocate_team_shift_week() RPC call per employee with a selection —
  // that RPC (SECURITY DEFINER) is the actual security boundary, checking
  // employees.shift_allocator_id = the caller before writing any row, so
  // this can't be a single bulk upsert the way HR's unscoped screen does it.
  const saveWeek = async (): Promise<boolean> => {
    const entries = Object.entries(selections).filter(([, shiftId]) => shiftId)
    if (entries.length === 0) return false

    setIsSaving(true)
    const results = await Promise.all(
      entries.map(([employeeId, shiftId]) =>
        supabase.rpc('allocate_team_shift_week', {
          p_employee_id: employeeId,
          p_shift_id: shiftId,
          p_week_start: weekStart,
        })
      )
    )
    setIsSaving(false)
    return results.every(r => !r.error)
  }

  // Daily-mode equivalent of saveWeek() — same per-employee RPC pattern,
  // one date instead of six, via allocate_team_shift_day() (PATCH_135).
  const saveDay = async (): Promise<boolean> => {
    const entries = Object.entries(selections).filter(([, shiftId]) => shiftId)
    if (entries.length === 0) return false

    setIsSaving(true)
    const results = await Promise.all(
      entries.map(([employeeId, shiftId]) =>
        supabase.rpc('allocate_team_shift_day', {
          p_employee_id: employeeId,
          p_shift_id: shiftId,
          p_date: date,
        })
      )
    )
    setIsSaving(false)
    return results.every(r => !r.error)
  }

  return {
    weekOffset,
    setWeekOffset,
    weekStart,
    weekDays,
    dayOffset,
    setDayOffset,
    date,
    shifts,
    team,
    selections,
    select,
    saveWeek,
    saveDay,
    isLoading,
    isSaving,
  }
}
