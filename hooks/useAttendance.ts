import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types'
import { attendanceDateStr, istMonthYear, getMonthEndDay } from '@/lib/istDate'
import { finalizeShiftAndOvertime, HALF_DAY_MAX_HOURS } from '@/lib/workingHours'

export function useAttendance(employeeId: string, month?: string, year?: number) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)

    const { month: istMonth, year: istYear } = istMonthYear()
    const targetMonth = month || istMonth
    const targetYear = year || istYear
    const monthEndDay = getMonthEndDay(targetMonth, targetYear)

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', `${targetYear}-${targetMonth}-01`)
      .lte('date', `${targetYear}-${targetMonth}-${String(monthEndDay).padStart(2, '0')}`)
      .order('date', { ascending: true })

    if (!error && data) {
      setRecords(data as AttendanceRecord[])
    }

    const { data: todayData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', attendanceDateStr())
      .maybeSingle()

    // Night shifts (Shift 3, Security Night) check out after the 06:45 rollover,
    // so fall back to a still-open record from the last 14h (the max sane shift).
    let current = todayData as AttendanceRecord | null
    if (!current) {
      const { data: open } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', employeeId)
        .is('check_out_time', null)
        .gte('check_in_time', new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString())
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle()
      current = open as AttendanceRecord | null
    }
    setTodayRecord(current)
    setIsLoading(false)
  }, [employeeId, month, year])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // lateMinutes: the EFFECTIVE late minutes (0 if within grace period) — callers
  // compute raw lateness, apply the shift's grace, pass 0 if within grace.
  // status is derived here so it's always consistent with what's in the DB.
  const checkIn = async (
    lat: number,
    lng: number,
    lateMinutes: number,
    lateReason?: string,
    mockDetected?: boolean,
    deviceId?: string
  ) => {
    const now = new Date()
    const date = attendanceDateStr()
    const time = now.toISOString()
    const status = lateMinutes > 0 ? 'L' : 'P'

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(
        {
          employee_id: employeeId,
          date,
          status,
          check_in_time: time,
          check_in_lat: lat,
          check_in_lng: lng,
          late_minutes: lateMinutes > 0 ? lateMinutes : null,
          late_reason: lateReason || null,
          qr_verified: false,
          mock_location_detected: mockDetected || false,
          device_id: deviceId || null,
        },
        { onConflict: 'employee_id,date' }
      )
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  // shiftEndTime: no longer used for the half-day decision (see HALF_DAY_MAX_HOURS
  // below, Yash's 6 Oct 2026 correction) — kept in the signature only because both
  // call sites already pass it and it costs nothing to leave in place.
  // shiftName: today's resolved shift name (HR-assigned or inferred,
  // doesn't matter which — see lib/workingHours.ts's finalizeShiftAndOvertime),
  // used once hours_worked is final to compute overtime and, if the day
  // crossed 12h on Shift 1/Shift 3, reclassify it to Shift 4/Shift 5.
  const checkOut = async (lat: number, lng: number, shiftEndTime?: string, shiftName?: string) => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    const now = new Date()
    const time = now.toISOString()

    let hours_worked: number | undefined
    if (todayRecord?.check_in_time) {
      const elapsed = now.getTime() - new Date(todayRecord.check_in_time).getTime()
      hours_worked = Math.round((elapsed / 3600000) * 100) / 100
    }

    // Half-day — Yash, 6 Oct 2026: "being late is being marked absent is not
    // a rule or logic we have decided, the decision should be based on
    // working hours. if hours worked is 4 or less then half day." This
    // REPLACES the old late-minutes-based half-day rule (3+ hrs late AND
    // checked out at/before shift end) — lateness no longer has any role in
    // deciding present vs half-day vs absent. Someone who has checked in is
    // never downgraded further than half-day here, regardless of how late
    // they arrived — see HALF_DAY_MAX_HOURS below.
    const halfDay = typeof hours_worked === 'number' && hours_worked <= HALF_DAY_MAX_HOURS

    const updatePayload: Record<string, unknown> = {
      check_out_time: time,
      check_out_lat: lat,
      check_out_lng: lng,
      hours_worked,
    }
    if (halfDay) {
      updatePayload.status = 'HL'
    }

    // Finalize the day's shift + overtime now that hours_worked is final
    // (Yash, 6 Oct 2026 — see lib/workingHours.ts's finalizeShiftAndOvertime,
    // the single source of truth also ported into the 24h auto-checkout
    // edge function). Reclassifying the day's shift (Shift 1->4, Shift
    // 3->5 at 12h+) goes through set_my_shift_for_date, the same
    // SECURITY DEFINER RPC the check-in flow already uses — a direct
    // employee_shifts write is management-only under RLS (PATCH_59).
    if (typeof hours_worked === 'number') {
      const { reclassifyToShiftName, overtimeHours } = finalizeShiftAndOvertime(shiftName, hours_worked)
      updatePayload.overtime_hours = overtimeHours
      if (reclassifyToShiftName) {
        const { data: newShift } = await supabase
          .from('shifts')
          .select('id')
          .eq('name', reclassifyToShiftName)
          .maybeSingle()
        if (newShift?.id) {
          const { error: reclassifyError } = await supabase.rpc('set_my_shift_for_date', {
            p_date: todayRecord.date,
            p_shift_id: newShift.id,
            p_source: 'system_reclassified',
          })
          if (reclassifyError) console.warn('set_my_shift_for_date (overtime reclassify) failed', reclassifyError.message)
        }
      }
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .update(updatePayload)
      .eq('id', todayRecord.id)
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const confirmQr = async () => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    const { data, error } = await supabase
      .from('attendance_records')
      .update({ qr_verified: true })
      .eq('id', todayRecord.id)
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const confirmQrOut = async () => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    const { data, error } = await supabase
      .from('attendance_records')
      .update({ check_out_qr_verified: true })
      .eq('id', todayRecord.id)
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  return { records, todayRecord, isLoading, checkIn, checkOut, confirmQr, confirmQrOut, refresh: fetchRecords }
}
