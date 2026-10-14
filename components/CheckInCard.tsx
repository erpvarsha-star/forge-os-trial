import React, { useState, useEffect } from 'react'
import { View, Text, Alert, Modal, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import { QuoteOfTheDay } from '@/components/QuoteOfTheDay'
import { OntimeRaceCard } from '@/components/OntimeRaceCard'
import {
  getCheckInLocation,
  getPlantConfig,
  getPlantLocations,
  isWithinPlant,
  isValidGateQr,
} from '@/lib/location'
import { syncServerClock, serverIstNow, serverLateMinutesAgainst, serverAttendanceDateStr } from '@/lib/serverClock'
import { withTimeout } from '@/lib/withTimeout'
import { alertError, alertLocationFailure, invalidQrMessage } from '@/lib/alertError'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import { resolveShiftForCheckIn } from '@/lib/shiftInference'
import { EmployeeShift, Shift } from '@/types'
import { MapPin, CheckCircle2, QrCode, Star, X } from 'lucide-react-native'
import { CameraView, Camera } from 'expo-camera'
import { isPresentStatus } from '@/constants'
import { attendanceDateStr } from '@/lib/istDate'

/**
 * Every non-worker role (manager, hr-admin, supervisor, plant-head,
 * security, owner) checks in via this card instead of worker/home.tsx, but
 * until now had no way to do the QR half of check-in at all — worker/qr.tsx
 * is a route inside the (worker) group, gated to role 'member' only by
 * RoleGate, so it isn't reachable from any of these dashboards. Found and
 * fixed 24 Sep 2026 (reported: "manager doesn't see a QR scan option under
 * GPS"). Scanning logic mirrors app/(worker)/qr.tsx's, shown as a modal here
 * instead of a separate route so it works from any dashboard without new
 * per-role routes or RoleGate changes.
 */

export function CheckInCard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { records, todayRecord, checkIn, checkOut, confirmQr, confirmQrOut, refresh, isLoading: attendanceLoading, loadError } = useAttendance(
    employee?.id || ''
  )
  const presentDaysThisMonth = records.filter(r => isPresentStatus(r.status)).length
  const lateThisMonth = records.filter(r => r.status === 'L' || r.status === 'HL').length
  const [isLoading, setIsLoading] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState('')

  const [shift, setShift] = useState<EmployeeShift | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [showExitQrModal, setShowExitQrModal] = useState(false)
  const [exitQrScanned, setExitQrScanned] = useState(false)
  const [exitQrLoading, setExitQrLoading] = useState(false)

  useEffect(() => {
    if (!employee?.id) return
    const date = attendanceDateStr()
    supabase
      .from('employee_shifts')
      .select('*, shift:shifts(*)')
      .eq('employee_id', employee.id)
      .eq('date', date)
      .maybeSingle()
      .then(({ data }) => setShift(data as EmployeeShift | null))
  }, [employee?.id])

  useEffect(() => {
    if (!(showQrModal || showExitQrModal) || hasCameraPermission === true) return
    Camera.requestCameraPermissionsAsync()
      .then(({ status }) => setHasCameraPermission(status === 'granted'))
      .catch(() => setHasCameraPermission(false))
  }, [showQrModal, showExitQrModal])

  const openQrModal = () => {
    setScanned(false)
    setShowQrModal(true)
  }

  // Shared by entry and exit QR scans: clock sync, QR validity, GPS fix and
  // geofence. Returns false (after alerting) when the scan must not be confirmed.
  const validateQrScan = async (data: string, rearm: { text: string; onPress: () => void }[]) => {
    await syncServerClock()

    const plant = await withTimeout(getPlantConfig(), 10000, 'Plant config')
    if (!plant) {
      Alert.alert(t('common.error'), t('worker.plantConfigMissing'), rearm)
      return false
    }

    if (!isValidGateQr(data, plant)) {
      Alert.alert(t('common.error'), invalidQrMessage(t), rearm)
      return false
    }

    const loc = await getCheckInLocation()
    if (!loc.ok) {
      alertLocationFailure(t, loc.reason, rearm)
      return false
    }
    const location = loc.location

    const plantLocations = await withTimeout(getPlantLocations(), 10000, 'Plant locations')
    const inside = isWithinPlant(location.coords.latitude, location.coords.longitude, location.coords.accuracy, plantLocations, plant)

    if (!inside) {
      Alert.alert(t('common.warning'), t('worker.outsidePlant'), rearm)
      return false
    }
    return true
  }

  const handleQrScanned = async ({ data }: { data: string }) => {
    if (scanned || qrLoading || !employee) return
    setScanned(true)
    setQrLoading(true)
    const rearm = [{ text: 'OK', onPress: () => setScanned(false) }]

    try {
      if (!(await validateQrScan(data, rearm))) return

      const { error } = await confirmQr()
      if (error) {
        alertError(t, error, rearm)
      } else {
        await refresh()
        setShowQrModal(false)
        Alert.alert(t('common.success'), t('worker.qrConfirmedBody'))
      }
    } catch (e) {
      alertError(t, e, rearm)
    } finally {
      setQrLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!employee) return
    setIsLoading(true)
    try {
      await syncServerClock()

      const loc = await getCheckInLocation()
      if (!loc.ok) {
        alertLocationFailure(t, loc.reason)
        return
      }
      const location = loc.location
      const accuracy = location.coords.accuracy

      const plant = await withTimeout(getPlantConfig(), 10000, 'Plant config')
      if (!plant) {
        Alert.alert(t('common.error'), t('worker.plantConfigMissing'))
        return
      }

      const plantLocations = await withTimeout(getPlantLocations(), 10000, 'Plant locations')
      const inside = isWithinPlant(location.coords.latitude, location.coords.longitude, accuracy, plantLocations, plant)

      if (!inside) {
        Alert.alert(t('common.warning'), t('worker.outsidePlant'))
        return
      }

      // `location.mocked` — see the matching note in worker/home.tsx.
      // Location.getProviderStatusAsync().gpsAvailable was being used here as
      // a mock-GPS proxy; it isn't one, and was falsely flagging real check-ins
      // with no GPS satellite fix (indoors, weak signal) as fraud. Fixed 27
      // Sep 2026 — this was the confirmed root cause of VFL4057's blocked
      // check-in. See PENDING.md.
      const mockDetected = location.mocked === true
      const deviceId = await getDeviceId()

      // Fail open on a network error or timeout (see worker/home.tsx).
      let fraudCheck: any = null
      try {
        const res = await withTimeout(
          supabase.functions.invoke('fraud-detector', {
            body: {
              action: 'gps_check',
              employeeId: employee.id,
              lat: location.coords.latitude,
              lng: location.coords.longitude,
              mockLocationDetected: mockDetected,
              accuracyMeters: accuracy,
            },
          }),
          8000,
          'Fraud check'
        )
        if (!res.error) fraudCheck = res.data
      } catch {
        // fail open
      }

      if (fraudCheck?.allowed === false && fraudCheck?.reason === 'mock_location_detected') {
        Alert.alert(t('common.warning'), t('worker.mockLocationDetected'))
        return
      }

      const todayStr = serverAttendanceDateStr()
      try {
        const { data: buddyCheck } = await withTimeout(
          supabase
            .from('attendance_records')
            .select('employee_id')
            .eq('device_id', deviceId)
            .eq('date', todayStr)
            .neq('employee_id', employee.id)
            .maybeSingle(),
          5000,
          'Buddy check'
        )
        if (buddyCheck) {
          await supabase.from('fraud_flags').insert({
            employee_id: employee.id,
            flag_type: 'BUDDY_DEVICE',
            description: 'Same device used by another employee today',
          })
        }
      } catch {
        // buddy check is best-effort
      }

      // Read shift for today using IST date (already loaded in state, but re-fetch for freshness)
      let shiftData: any = null
      try {
        const res = await withTimeout(
          supabase
            .from('employee_shifts')
            .select('*, shift:shifts(*)')
            .eq('employee_id', employee.id)
            .eq('date', todayStr)
            .maybeSingle(),
          8000,
          'Shift lookup'
        )
        shiftData = res.data
      } catch {
        // non-fatal: falls back to inference below
      }

      // Check-in time decides the shift, even over HR's allocation (Yash, 28 Sep 2026).
      {
        const current = shiftData as EmployeeShift | null
        let allShifts: Shift[] = []
        try {
          const { data } = await withTimeout(supabase.from('shifts').select('*'), 8000, 'Shift lookup')
          allShifts = (data || []) as Shift[]
        } catch {
          // non-fatal: lateness is simply not evaluated, as before
        }
        const istNowForShift = serverIstNow()
        const nowMinutesOfDay = istNowForShift.getUTCHours() * 60 + istNowForShift.getUTCMinutes()
        // No employee_shifts row for today — fall back to this employee's own
        // default_shift_id (PATCH_71, e.g. Kajal/VFL1567's "General (Pune)"
        // 10am start) before the generic closest-shift inference, so it gets
        // the same 60-min-early + grace treatment as an HR-assigned shift
        // would, instead of competing in findClosestShift()'s shared pool
        // against General's own window.
        const assignedShift =
          current?.shift ?? allShifts.find(s => s.id === employee.default_shift_id) ?? null
        const resolved = resolveShiftForCheckIn(assignedShift, nowMinutesOfDay, employee.role, allShifts)
        if (resolved && resolved.id !== current?.shift_id) {
          try {
            const { error: shiftError } = await withTimeout(
              supabase.rpc('set_my_shift_for_date', { p_date: todayStr, p_shift_id: resolved.id, p_source: 'system_inferred' }),
              8000,
              'Shift update'
            )
            if (shiftError) console.warn('set_my_shift_for_date failed', shiftError.message)
          } catch (e) {
            console.warn('set_my_shift_for_date failed', e instanceof Error ? e.message : e)
          }
          shiftData = { ...(current ?? {}), employee_id: employee.id, date: todayStr, shift_id: resolved.id, shift: resolved } as any
        }
      }

      if (shiftData) setShift(shiftData as EmployeeShift)

      const grace = (shiftData as EmployeeShift | null)?.shift?.late_grace_minutes ?? 15
      let rawLateMinutes = 0
      if ((shiftData as EmployeeShift | null)?.shift?.start_time) {
        rawLateMinutes = serverLateMinutesAgainst((shiftData as EmployeeShift).shift.start_time as string)
      }

      const effectiveLateMinutes = rawLateMinutes > grace ? rawLateMinutes : 0

      if (rawLateMinutes > grace && !lateReason) {
        setShowLateModal(true)
        return
      }

      const { error: checkInError } = await checkIn(
        location.coords.latitude,
        location.coords.longitude,
        effectiveLateMinutes,
        lateReason || undefined,
        mockDetected,
        deviceId,
        accuracy
      )
      if (checkInError) alertError(t, checkInError)
      await refresh()
      if (!checkInError) setLateReason('')
    } catch (e) {
      alertError(t, e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!employee) return
    setIsLoading(true)
    try {
      await syncServerClock()

      const loc = await getCheckInLocation()
      if (!loc.ok) {
        alertLocationFailure(t, loc.reason)
        return
      }
      const location = loc.location

      const plant = await withTimeout(getPlantConfig(), 10000, 'Plant config')
      if (!plant) {
        Alert.alert(t('common.error'), t('worker.plantConfigMissing'))
        return
      }

      const plantLocations = await withTimeout(getPlantLocations(), 10000, 'Plant locations')
      const inside = isWithinPlant(location.coords.latitude, location.coords.longitude, location.coords.accuracy, plantLocations, plant)

      if (!inside) {
        Alert.alert(t('common.warning'), t('worker.outsidePlant'))
        return
      }

      const mockDetected = location.mocked === true
      if (mockDetected) {
        Alert.alert(t('common.warning'), t('worker.mockLocationDetected'))
        return
      }

      const { error: checkOutError } = await checkOut(
        location.coords.latitude,
        location.coords.longitude,
        shift?.shift?.end_time,
        shift?.shift?.name,
        location.coords.accuracy
      )
      if (checkOutError) {
        alertError(t, checkOutError)
        await refresh()
        return
      }
      await refresh()

      if (employee.requires_qr) {
        setExitQrScanned(false)
        setShowExitQrModal(true)
      }
    } catch (e) {
      alertError(t, e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExitQrScanned = async ({ data }: { data: string }) => {
    if (exitQrScanned || exitQrLoading || !employee) return
    setExitQrScanned(true)
    setExitQrLoading(true)
    const rearm = [{ text: 'OK', onPress: () => setExitQrScanned(false) }]

    try {
      if (!(await validateQrScan(data, rearm))) return

      const { error } = await confirmQrOut()
      if (error) {
        alertError(t, error, rearm)
      } else {
        await refresh()
        setShowExitQrModal(false)
        Alert.alert(t('common.success'), t('worker.exitQrConfirmed'))
      }
    } catch (e) {
      alertError(t, e, rearm)
    } finally {
      setExitQrLoading(false)
    }
  }

  const submitLateReason = async () => {
    if (!lateReason.trim()) return
    setShowLateModal(false)
    await handleCheckIn()
  }

  const isCheckedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time
  const isCheckedOut = !!todayRecord?.check_out_time

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <View className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden mb-5">
        <View className="px-5 py-6 items-center">
          {attendanceLoading && !todayRecord ? (
            <View className="py-3 items-center">
              <ActivityIndicator color="#E65C00" />
              <Text className="text-sm text-ink-400 mt-3">{t('worker.checkingStatus')}</Text>
            </View>
          ) : loadError && !todayRecord ? (
            <TouchableOpacity onPress={refresh} className="py-3 items-center">
              <Text className="text-sm text-ink-500 text-center">{t('common.loadFailedRetry')}</Text>
              <Text className="text-xs text-ink-400 mt-1 text-center">{loadError.message}</Text>
            </TouchableOpacity>
          ) : isCheckedOut ? (
            <View className="items-center">
              <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mb-3">
                <CheckCircle2 size={28} color="#16A34A" />
              </View>
              <Text className="text-base font-bold text-ink-900 mb-2 text-center">
                {t('worker.shiftComplete')}
              </Text>
              {todayRecord?.check_in_time && (
                <Text className="text-xs text-ink-500 text-center">
                  {t('worker.checkedInAt', { time: formatTime(todayRecord.check_in_time) })}
                </Text>
              )}
              {todayRecord?.check_out_time && (
                <Text className="text-xs text-ink-500 text-center">
                  {t('worker.checkedOutAt', { time: formatTime(todayRecord.check_out_time) })}
                </Text>
              )}
            </View>
          ) : (
            <>
              <Button
                title={isCheckedIn ? 'worker.gpsCheckOut' : 'worker.gpsCheckIn'}
                onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
                loading={isLoading}
                variant={isCheckedIn ? 'danger' : 'primary'}
                size="lg"
                className="w-full"
                icon={<MapPin size={22} color="white" />}
              />
              {isCheckedIn && todayRecord?.check_in_time ? (
                <Text className="text-xs text-ink-500 mt-3 text-center">
                  {t('worker.checkedInAt', { time: formatTime(todayRecord.check_in_time) })}
                </Text>
              ) : (
                <Text className="text-xs text-ink-400 mt-3 text-center">
                  {t('worker.tapWhenInsidePlant')}
                </Text>
              )}
            </>
          )}
        </View>
        {!attendanceLoading && (
          <View className="border-t border-ink-100 px-5 py-3 flex-row justify-between items-center">
            <View>
              <Text className="text-xs text-ink-500">{t('worker.presentThisMonth')}</Text>
              <Text className="text-sm font-bold text-ink-900">{presentDaysThisMonth} {t('worker.days')}</Text>
            </View>
            {lateThisMonth > 0 && (
              <View className="items-end">
                <Text className="text-xs text-ink-500">{t('worker.lateThisMonth')}</Text>
                <Text className="text-sm font-bold text-amber-600">{lateThisMonth} {t('worker.days')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Quote of the Day — shown once checked in, for every role (Yash, 6 Oct 2026) */}
      {(isCheckedIn || isCheckedOut) && (
        <View className="mb-5">
          <QuoteOfTheDay />
          <View className="mt-3">
            <OntimeRaceCard refreshKey={isCheckedOut ? 'out' : 'in'} />
          </View>
        </View>
      )}

      {/* Entry QR — shown while checked in */}
      {employee?.requires_qr && isCheckedIn && (
        todayRecord?.qr_verified ? (
          <View className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mb-5">
            <View className="px-5 py-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center">
                <Star size={22} color="#D97706" fill="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t('worker.qrStarEarned')}</Text>
                <Text className="text-xs text-ink-500">{t('worker.qrStarEarnedHint')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={openQrModal}
            className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden mb-5"
          >
            <View className="px-5 py-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                <QrCode size={22} color="#E65C00" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t('worker.scanQrForStar')}</Text>
                <Text className="text-xs text-ink-500">{t('worker.scanQrForStarHint')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      )}

      {/* Exit QR — shown after GPS checkout */}
      {employee?.requires_qr && isCheckedOut && (
        todayRecord?.check_out_qr_verified ? (
          <View className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden mb-5">
            <View className="px-5 py-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
                <CheckCircle2 size={22} color="#16A34A" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t('worker.exitQrDone')}</Text>
                <Text className="text-xs text-ink-500">{t('worker.exitQrDoneHint')}</Text>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => { setExitQrScanned(false); setShowExitQrModal(true) }}
            className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden mb-5"
          >
            <View className="px-5 py-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                <QrCode size={22} color="#E65C00" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t('worker.scanExitQr')}</Text>
                <Text className="text-xs text-ink-500">{t('worker.scanExitQrHint')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      )}

      <Modal visible={showQrModal} animationType="slide" onRequestClose={() => setShowQrModal(false)}>
        <View className="flex-1 bg-ink-50">
          <View className="flex-row items-center justify-between px-4 pt-12 pb-2">
            <Text className="text-base font-bold text-ink-900">{t('worker.qrCheckIn')}</Text>
            <TouchableOpacity onPress={() => setShowQrModal(false)} className="p-2">
              <X size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          {hasCameraPermission === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#E65C00" />
            </View>
          ) : hasCameraPermission === false ? (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-sm text-ink-500 text-center mb-4">{t('worker.cameraPermissionRequired')}</Text>
              <Button title="common.close" onPress={() => setShowQrModal(false)} variant="ghost" />
            </View>
          ) : (
            <View className="flex-1 p-4">
              <Text className="text-xs text-ink-500 text-center mb-3 px-2">{t('worker.qrHint')}</Text>
              <Card className="flex-1 items-center justify-center">
                <View className="w-full h-full">
                  <CameraView
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={scanned ? undefined : handleQrScanned}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="w-48 h-48 border-2 border-brand-500 rounded-lg opacity-50" />
                  </View>
                  <View className="absolute bottom-8 left-0 right-0 items-center">
                    <Text className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                      {scanned ? t('common.loading') : t('worker.scanQr')}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showLateModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-2">{t('worker.lateReason')}</Text>
            <Input
              value={lateReason}
              onChangeText={setLateReason}
              placeholder={t('common.reason')}
              multiline
              numberOfLines={3}
              className="mb-4"
            />
            <Button title="common.submit" onPress={submitLateReason} loading={isLoading} />
            <Button
              title="common.cancel"
              onPress={() => setShowLateModal(false)}
              variant="ghost"
            />
          </View>
        </View>
      </Modal>

      {/* Exit QR scanner modal */}
      <Modal visible={showExitQrModal} animationType="slide" onRequestClose={() => setShowExitQrModal(false)}>
        <View className="flex-1 bg-ink-50">
          <View className="flex-row items-center justify-between px-4 pt-12 pb-2">
            <Text className="text-base font-bold text-ink-900">{t('worker.exitQrTitle')}</Text>
            <TouchableOpacity onPress={() => setShowExitQrModal(false)} className="p-2">
              <X size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          {hasCameraPermission === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#E65C00" />
            </View>
          ) : hasCameraPermission === false ? (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-sm text-ink-500 text-center mb-4">{t('worker.cameraPermissionRequired')}</Text>
              <Button title="common.close" onPress={() => setShowExitQrModal(false)} variant="ghost" />
            </View>
          ) : (
            <View className="flex-1 p-4">
              <Text className="text-xs text-ink-500 text-center mb-3 px-2">{t('worker.exitQrHint')}</Text>
              <Card className="flex-1 items-center justify-center">
                <View className="w-full h-full">
                  <CameraView
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={exitQrScanned ? undefined : handleExitQrScanned}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="w-48 h-48 border-2 border-brand-500 rounded-lg opacity-50" />
                  </View>
                  <View className="absolute bottom-8 left-0 right-0 items-center">
                    <Text className="text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                      {exitQrScanned ? t('common.loading') : t('worker.scanQr')}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          )}
        </View>
      </Modal>
    </>
  )
}
