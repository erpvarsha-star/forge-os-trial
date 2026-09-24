import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types'

// Returns today's date string in IST (YYYY-MM-DD). Critical for Shift 3
// (00:00–07:00 IST): at 01:00 IST, UTC is still the previous day, so a
// plain toISOString().slice(0,10) would write yesterday's date.
const istDateStr = () =>
  new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

export function useAttendance(employeeId: string, month?: string, year?: number) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)

    const now = new Date()
    const targetMonth = month || String(now.getMonth() + 1).padStart(2, '0')
    const targetYear = year || now.getFullYear()

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', `${targetYear}-${targetMonth}-01`)
      .lte('date', `${targetYear}-${targetMonth}-31`)
      .order('date', { ascending: true })

    if (!error && data) {
      setRecords(data as AttendanceRecord[])
    }

    const today = istDateStr()
    const { data: todayData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle()

    setTodayRecord(todayData as AttendanceRecord | null)
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
    const date = istDateStr()
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

  // shiftEndTime: the shift's end_time (HH:MM). Used for:
  //   1. Computing hours_worked
  //   2. Half-day rule: arrived 3+ hrs late AND checks out at or before shift end → HL
  const checkOut = async (lat: number, lng: number, shiftEndTime?: string) => {
    const now = new Date()
    const date = istDateStr()
    const time = now.toISOString()

    let hours_worked: number | undefined
    if (todayRecord?.check_in_time) {
      const elapsed = now.getTime() - new Date(todayRecord.check_in_time).getTime()
      hours_worked = Math.round((elapsed / 3600000) * 100) / 100
    }

    // Half-day: came 3+ hours late AND checked out at or before the shift end time.
    // "00:00" as an end time means midnight (end of shift), treated as 24:00 = 1440 min.
    let halfDay = false
    if (todayRecord?.late_minutes && todayRecord.late_minutes >= 180 && shiftEndTime) {
      const [sh, sm] = shiftEndTime.split(':').map(Number)
      const shiftEndMins = sh === 0 && sm === 0 ? 24 * 60 : sh * 60 + sm
      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const checkoutMins = istNow.getUTCHours() * 60 + istNow.getUTCMinutes()
      halfDay = checkoutMins <= shiftEndMins
    }

    const updatePayload: Record<string, unknown> = {
      check_out_time: time,
      check_out_lat: lat,
      check_out_lng: lng,
      hours_worked,
    }
    if (halfDay) {
      updatePayload.status = 'HL'
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .update(updatePayload)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const confirmQr = async () => {
    const date = istDateStr()
    const { data, error } = await supabase
      .from('attendance_records')
      .update({ qr_verified: true })
      .eq('employee_id', employeeId)
      .eq('date', date)
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  return { records, todayRecord, isLoading, checkIn, checkOut, confirmQr, refresh: fetchRecords }
}
