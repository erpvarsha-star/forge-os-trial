import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types'

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

    const today = now.toISOString().split('T')[0]
    const { data: todayData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .single()

    setTodayRecord(todayData as AttendanceRecord | null)
    setIsLoading(false)
  }, [employeeId, month, year])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const checkIn = async (lat: number, lng: number, lateReason?: string, mockDetected?: boolean, deviceId?: string) => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toISOString()

    const { data, error } = await supabase
      .from('attendance_records')
      .upsert({
        employee_id: employeeId,
        date,
        status: 'P',
        check_in_time: time,
        check_in_lat: lat,
        check_in_lng: lng,
        late_reason: lateReason || null,
        qr_verified: false,
        mock_location_detected: mockDetected || false,
        device_id: deviceId || null,
      })
      .select()
      .single()

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const checkOut = async (lat: number, lng: number) => {
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toISOString()

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out_time: time,
        check_out_lat: lat,
        check_out_lng: lng,
      })
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

  return { records, todayRecord, isLoading, checkIn, checkOut, refresh: fetchRecords }
}
