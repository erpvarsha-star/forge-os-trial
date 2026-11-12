import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AttendanceRecord } from '@/types'
import { istMonthYear, getMonthEndDay } from '@/lib/istDate'
import { serverNowMs, serverAttendanceDateStr, serverIstDateStr } from '@/lib/serverClock'
import { withTimeout } from '@/lib/withTimeout'
import { finalizeShiftAndOvertime, HALF_DAY_MAX_HOURS, OPEN_RECORD_FALLBACK_HOURS, UNDO_CHECKOUT_WINDOW_MINUTES, ACCIDENTAL_TAP_MINUTES } from '@/lib/workingHours'

// Stored to one decimal; null when the phone reported no accuracy.
const roundAccuracy = (m?: number | null) =>
  typeof m === 'number' && Number.isFinite(m) ? Math.round(m * 10) / 10 : null

export function useAttendance(employeeId: string, month?: string, year?: number) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const fetchRecords = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    setLoadError(null)

    try {
      const { month: istMonth, year: istYear } = istMonthYear()
      const targetMonth = month || istMonth
      const targetYear = year || istYear
      const monthEndDay = getMonthEndDay(targetMonth, targetYear)

      const { data, error } = await withTimeout(
        supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', employeeId)
          .gte('date', `${targetYear}-${targetMonth}-01`)
          .lte('date', `${targetYear}-${targetMonth}-${String(monthEndDay).padStart(2, '0')}`)
          .order('date', { ascending: true }),
        15000,
        'Attendance load'
      )

      if (!error && data) {
        setRecords(data as AttendanceRecord[])
      }

      // Genuinely open record FIRST — before whatever happens to be dated
      // "today" (bug fix, 12 Nov 2026). Night shifts (Shift 3/5, Security
      // Night) check out after the 06:45 rollover, so their real open
      // session is often still dated yesterday; checking "today"'s dated
      // row first used to be safe ONLY because a day with no row at all
      // meant "not checked in" — but a WEEKLY-OFF placeholder row
      // (status='WO', no check_in_time, written by the mark_weekly_offs
      // cron at 00:01 IST) also counts as "a row exists for today" to a
      // naive date-first lookup. A night-shift worker whose real open shift
      // was still running from the previous day, checking out after that
      // WO row had already been written, would see the WO row, be offered
      // "Check In" instead of "Check Out", tap it, and get a spurious
      // few-minutes-later check-in/check-out on the WO row — a false 'HL'
      // half-day, while their real open night shift later gets silently
      // auto-closed at default hours by the hourly cron. Confirmed real
      // case: VFL4071, 6-7 Nov 2026.
      //
      // So: look for a genuinely open record (check_in_time set,
      // check_out_time still null) within OPEN_RECORD_FALLBACK_HOURS
      // (lib/workingHours.ts) FIRST, regardless of its date — kept just
      // under the 24h auto-checkout server cutoff so the UI never loses
      // track of a row the server itself still considers open. Only when
      // NO open record exists do we fall back to whatever is dated "today"
      // (WO placeholder included) to decide what the UI should offer.
      const { data: open, error: openError } = await withTimeout(
        supabase
          .from('attendance_records')
          .select('*')
          .eq('employee_id', employeeId)
          .is('check_out_time', null)
          .not('check_in_time', 'is', null)
          .gte('check_in_time', new Date(serverNowMs() - OPEN_RECORD_FALLBACK_HOURS * 60 * 60 * 1000).toISOString())
          .order('check_in_time', { ascending: false })
          .limit(1)
          .maybeSingle(),
        15000,
        'Attendance load'
      )

      let current = open as AttendanceRecord | null
      let todayError: any = null
      if (!current) {
        const res = await withTimeout(
          supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('date', serverAttendanceDateStr())
            .maybeSingle(),
          15000,
          'Attendance load'
        )
        todayError = res.error
        current = res.data as AttendanceRecord | null
      }
      if (error || openError || todayError) throw new Error((error || openError || todayError)!.message)
      // Still nothing open? A night-shift checkout just past the 06:45 rollover closes
      // check_out_time right before this same function re-runs (checkOut()'s own
      // fetchRecords() call) — the open-record fallback above then misses it too, wrongly
      // clearing todayRecord and breaking Exit QR. Catch that narrow just-closed case only.
      if (!current) {
        const { data: justClosed } = await withTimeout(
          supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('check_out_time', new Date(serverNowMs() - UNDO_CHECKOUT_WINDOW_MINUTES * 60 * 1000).toISOString())
            .gte('check_in_time', new Date(serverNowMs() - OPEN_RECORD_FALLBACK_HOURS * 60 * 60 * 1000).toISOString())
            .order('check_out_time', { ascending: false })
            .limit(1)
            .maybeSingle(),
          15000,
          'Attendance load'
        )
        current = justClosed as AttendanceRecord | null
      }
      setTodayRecord(current)
    } catch (e) {
      // Surface the failure so the screen can offer a retry instead of an endless spinner.
      setLoadError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setIsLoading(false)
    }
  }, [employeeId, month, year])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // lateMinutes: the EFFECTIVE late minutes (0 if within grace period) — callers
  // compute raw lateness, apply the shift's grace, pass 0 if within grace.
  // status is derived here so it's always consistent with what's in the DB.
  //
  // isNightShift (bug fix, 12 Nov 2026): whether the shift actually resolved
  // for THIS punch (lib/shiftInference.ts's resolveShiftForCheckIn/
  // findClosestShift, already run by both callers before calling checkIn())
  // is a night shift (Shift 3/5, Security Night — shifts.is_night_shift).
  // serverAttendanceDateStr() rolls the attendance day over at 06:45 IST for
  // EVERYONE, which is only correct for a night shift still running past
  // midnight (per the "Shift 3 belongs to the previous working day" rule,
  // CLAUDE.md, 28 Sep 2026) — a day-shift worker punching in before 06:45
  // for genuine pre-shift work (e.g. starting furnaces) was getting filed
  // under YESTERDAY's date, and then late-minutes math run against
  // whichever shift that wrong date implied. Decision, in order:
  //   1. If there's a genuinely open (checked-in, not checked-out) record
  //      from a PREVIOUS date, this punch is part of an already-running
  //      night session regardless of what shift it would otherwise resolve
  //      to (e.g. a mid-shift QR re-scan) — file under the rolled-back date,
  //      unchanged from before.
  //   2. Else if the shift resolved for this punch is itself a night shift,
  //      file under the rolled-back date — unchanged from before, and the
  //      existing Shift-3/5/Security-Night boundary cases are untouched.
  //   3. Otherwise, file under the REAL current IST date.
  // Outside the 00:00-06:45 IST window the two dates are identical, so this
  // only ever changes behavior in the window the bug actually lives in.
  const checkIn = async (
    lat: number,
    lng: number,
    lateMinutes: number,
    lateReason?: string,
    mockDetected?: boolean,
    deviceId?: string,
    accuracyM?: number | null,
    isNightShift?: boolean
  ) => {
    // Server-corrected time: a wrong phone clock must not become the recorded check-in.
    const now = new Date(serverNowMs())
    const trueDate = serverIstDateStr()
    const rolledBackDate = serverAttendanceDateStr()

    let date = trueDate
    if (rolledBackDate !== trueDate) {
      let continuingNightShift = isNightShift === true
      if (!continuingNightShift) {
        // Safety net, best-effort: an open unfinished record from a
        // genuinely earlier date means a real night session is still
        // running even if this specific punch's own shift resolution
        // didn't come back as a night shift (e.g. shift lookup failed).
        try {
          const { data: openPrev } = await withTimeout(
            supabase
              .from('attendance_records')
              .select('id')
              .eq('employee_id', employeeId)
              .is('check_out_time', null)
              .not('check_in_time', 'is', null)
              .lt('date', trueDate)
              .limit(1)
              .maybeSingle(),
            8000,
            'Open record check'
          )
          if (openPrev) continuingNightShift = true
        } catch {
          // Can't tell — fall through using isNightShift alone, never block check-in on this.
        }
      }
      date = continuingNightShift ? rolledBackDate : trueDate
    }

    const time = now.toISOString()
    const status = lateMinutes > 0 ? 'L' : 'P'

    let data: any = null
    let error: any = null
    try {
      const res = await withTimeout(
        supabase
          .from('attendance_records')
          .upsert(
            {
              employee_id: employeeId,
              date,
              status,
              check_in_time: time,
              check_in_lat: lat,
              check_in_lng: lng,
              check_in_accuracy_m: roundAccuracy(accuracyM),
              late_minutes: lateMinutes > 0 ? lateMinutes : null,
              late_reason: lateReason || null,
              qr_verified: false,
              mock_location_detected: mockDetected || false,
              device_id: deviceId || null,
            },
            { onConflict: 'employee_id,date' }
          )
          .select()
          .single(),
        15000,
        'Check-in save'
      )
      data = res.data
      error = res.error
    } catch (e) {
      error = e
    }

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
  const checkOut = async (lat: number, lng: number, shiftEndTime?: string, shiftName?: string, accuracyM?: number | null) => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    const now = new Date(serverNowMs())
    const time = now.toISOString()

    let hours_worked: number | undefined
    if (todayRecord?.check_in_time) {
      const elapsed = now.getTime() - new Date(todayRecord.check_in_time).getTime()
      hours_worked = Math.round((elapsed / 3600000) * 100) / 100
    }

    // Accidental tap-in/tap-out guard (this session's own diagnosis, 12 Nov
    // 2026 — see ACCIDENTAL_TAP_MINUTES in lib/workingHours.ts for the full
    // reasoning). An elapsed time this short between check-in and check-out
    // can only be a mis-tap, never a real half-day, so the half-day logic
    // and the overtime/shift-reclassification logic below are both skipped
    // for it — status is left exactly as check-in already set it ('P'/'L'),
    // never downgraded to 'HL'.
    const elapsedMinutesSinceCheckIn = todayRecord?.check_in_time
      ? (now.getTime() - new Date(todayRecord.check_in_time).getTime()) / 60000
      : null
    const isAccidentalTap =
      typeof elapsedMinutesSinceCheckIn === 'number' &&
      elapsedMinutesSinceCheckIn >= 0 &&
      elapsedMinutesSinceCheckIn < ACCIDENTAL_TAP_MINUTES

    // Half-day — Yash, 6 Oct 2026: "being late is being marked absent is not
    // a rule or logic we have decided, the decision should be based on
    // working hours. if hours worked is 4 or less then half day." This
    // REPLACES the old late-minutes-based half-day rule (3+ hrs late AND
    // checked out at/before shift end) — lateness no longer has any role in
    // deciding present vs half-day vs absent. Someone who has checked in is
    // never downgraded further than half-day here, regardless of how late
    // they arrived — see HALF_DAY_MAX_HOURS below. Never applies to an
    // accidental tap (see above) — that is not a valid half-day.
    const halfDay = !isAccidentalTap && typeof hours_worked === 'number' && hours_worked <= HALF_DAY_MAX_HOURS

    const updatePayload: Record<string, unknown> = {
      check_out_time: time,
      check_out_lat: lat,
      check_out_lng: lng,
      check_out_accuracy_m: roundAccuracy(accuracyM),
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
    // Skipped entirely for an accidental tap: overtime is simply 0 and the
    // day can never have crossed 12h, so there is nothing to reclassify.
    if (isAccidentalTap) {
      if (typeof hours_worked === 'number') updatePayload.overtime_hours = 0
    } else if (typeof hours_worked === 'number') {
      const { reclassifyToShiftName, overtimeHours } = finalizeShiftAndOvertime(shiftName, hours_worked)
      updatePayload.overtime_hours = overtimeHours
      if (reclassifyToShiftName) {
        // Non-fatal: the checkout itself must still go through.
        try {
          const { data: newShift } = await withTimeout(
            supabase.from('shifts').select('id').eq('name', reclassifyToShiftName).maybeSingle(),
            8000,
            'Shift lookup'
          )
          if (newShift?.id) {
            const { error: reclassifyError } = await withTimeout(
              supabase.rpc('set_my_shift_for_date', {
                p_date: todayRecord.date,
                p_shift_id: newShift.id,
                p_source: 'system_reclassified',
              }),
              8000,
              'Shift update'
            )
            if (reclassifyError) console.warn('set_my_shift_for_date (overtime reclassify) failed', reclassifyError.message)
          }
        } catch (e) {
          console.warn('overtime reclassify skipped', e instanceof Error ? e.message : e)
        }
      }
    }

    let data: any = null
    let error: any = null
    try {
      const res = await withTimeout(
        supabase.from('attendance_records').update(updatePayload).eq('id', todayRecord.id).select().single(),
        15000,
        'Check-out save'
      )
      data = res.data
      error = res.error
    } catch (e) {
      error = e
    }

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  // Undo an accidental immediate checkout (within UNDO_CHECKOUT_WINDOW_MINUTES
  // of check-in, gated by the caller via lib/workingHours.ts's
  // canUndoCheckout() before this is even offered/called). A plain UPDATE,
  // not an upsert — unlike checkIn(), this must never touch check_in_time
  // (or late_minutes/late_reason/qr_verified/mock_location_detected/
  // device_id), only reverse what checkOut() itself set.
  //
  // Status revert: checkOut() may have flipped status to 'HL' via the
  // HALF_DAY_MAX_HOURS branch; undoing the checkout means that threshold no
  // longer applies, so status reverts to whatever check-in time alone would
  // have produced — 'L' if late_minutes is set and > 0, else 'P' — same
  // derivation checkIn() itself uses.
  //
  // Shift reclassification (Shift 1->4 / Shift 3->5 at 12h+ hours_worked,
  // via set_my_shift_for_date p_source:'system_reclassified') is
  // deliberately NOT reverted here: that branch only fires at 12h+
  // hours_worked, which cannot happen within the short undo window this is
  // gated to, so it's out of scope by construction.
  const undoCheckout = async () => {
    if (!todayRecord?.check_out_time) return { data: null, error: new Error('No checkout to undo') }

    const revertedStatus =
      typeof todayRecord.late_minutes === 'number' && todayRecord.late_minutes > 0 ? 'L' : 'P'

    const updatePayload: Record<string, unknown> = {
      check_out_time: null,
      check_out_lat: null,
      check_out_lng: null,
      check_out_accuracy_m: null,
      hours_worked: null,
      overtime_hours: null,
      status: revertedStatus,
    }

    let data: any = null
    let error: any = null
    try {
      const res = await withTimeout(
        supabase.from('attendance_records').update(updatePayload).eq('id', todayRecord.id).select().single(),
        15000,
        'Undo checkout save'
      )
      data = res.data
      error = res.error
    } catch (e) {
      error = e
    }

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const confirmQr = async () => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    let data: any = null
    let error: any = null
    try {
      const res = await withTimeout(
        supabase.from('attendance_records').update({ qr_verified: true }).eq('id', todayRecord.id).select().single(),
        15000,
        'QR confirm save'
      )
      data = res.data
      error = res.error
    } catch (e) {
      error = e
    }

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  const confirmQrOut = async () => {
    if (!todayRecord) return { data: null, error: new Error('No open attendance record') }
    let data: any = null
    let error: any = null
    try {
      const res = await withTimeout(
        supabase.from('attendance_records').update({ check_out_qr_verified: true }).eq('id', todayRecord.id).select().single(),
        15000,
        'QR confirm save'
      )
      data = res.data
      error = res.error
    } catch (e) {
      error = e
    }

    if (!error && data) {
      setTodayRecord(data as AttendanceRecord)
      await fetchRecords()
    }

    return { data, error }
  }

  return { records, todayRecord, isLoading, loadError, checkIn, checkOut, undoCheckout, confirmQr, confirmQrOut, refresh: fetchRecords }
}
