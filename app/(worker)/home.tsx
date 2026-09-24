import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Header } from '@/components/Header'
import { FactoryOsLink } from '@/components/FactoryOsLink'
import { SafetyTip } from '@/components/SafetyTip'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { getCurrentLocation, getPlantConfig, isInsideGeofence, getPlantLocations, isInsideAnyGeofence, buildQrValue } from '@/lib/location'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import { EmployeeShift } from '@/types'
import { MAX_DAILY_OBSERVATIONS } from '@/constants'
import { MapPin, Clock, CheckSquare, AlertCircle, Camera, QrCode, CheckCircle2, Calendar, ChevronRight, Star, X, LogOut } from 'lucide-react-native'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { router } from 'expo-router'
import * as Location from 'expo-location'

export default function WorkerHome() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, checkIn, checkOut, confirmQrOut, refresh, isLoading: attendanceLoading } = useAttendance(employee?.id || '')
  const [shift, setShift] = useState<EmployeeShift | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState('')
  const [checklist, setChecklist] = useState([false, false, false])
  const [observationCount, setObservationCount] = useState(0)
  const [showExitQrModal, setShowExitQrModal] = useState(false)
  const [exitQrScanned, setExitQrScanned] = useState(false)
  const [exitQrLoading, setExitQrLoading] = useState(false)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)

  useEffect(() => {
    fetchShift()
    fetchObservationCount()
  }, [employee])

  const istDateStr = () =>
    new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const fetchShift = async () => {
    if (!employee) return
    const today = istDateStr()
    const { data } = await supabase
      .from('employee_shifts')
      .select('*, shift:shifts(*)')
      .eq('employee_id', employee.id)
      .eq('date', today)
      // maybeSingle, not single: most employees have no shift row for today,
      // and single() treats "no rows" as an error (PGRST116).
      .maybeSingle()
    if (data) setShift(data as EmployeeShift)
  }

  const fetchObservationCount = async () => {
    if (!employee) return
    const today = istDateStr()
    const { count } = await supabase
      .from('maintenance_observations')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employee.id)
      .gte('created_at', `${today}T00:00:00`)
    setObservationCount(count || 0)
  }

  const handleCheckIn = async () => {
    if (!employee) return
    setIsLoading(true)

    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location permission required')
      setIsLoading(false)
      return
    }

    const plant = await getPlantConfig()
    if (!plant) {
      Alert.alert(t('common.error'), 'Plant config not found')
      setIsLoading(false)
      return
    }

    // PATCH_21 — multi-point geofence (11 named campus locations). Falls
    // back to the single-point plant_config check when plant_locations is
    // empty (PATCH_22 not yet run, or the table doesn't exist yet), so this
    // is safe to ship ahead of the seed data.
    const plantLocations = await getPlantLocations()
    const inside =
      plantLocations.length > 0
        ? isInsideAnyGeofence(location.coords.latitude, location.coords.longitude, plantLocations)
        : isInsideGeofence(
            location.coords.latitude,
            location.coords.longitude,
            plant.latitude,
            plant.longitude,
            plant.geofence_radius_meters
          )

    if (!inside) {
      Alert.alert(t('common.warning'), t('worker.outsidePlant'))
      setIsLoading(false)
      return
    }

    // Step 5 fraud detection: mock-location + same-device-different-employee ("buddy device")
    const providerStatus = await Location.getProviderStatusAsync()
    const mockDetected = !providerStatus.gpsAvailable
    const deviceId = await getDeviceId()

    // Mock-location apps are checked server-side too — the fraud-detector
    // edge function logs a fraud_alerts row management actually sees (the
    // isInsideGeofence check above never wrote one, and a modified APK could
    // skip it entirely, so this is the real enforcement point for mock
    // location). Fail open on a network error: the plant's connectivity is
    // patchy and a fraud check that can't be reached must never block a
    // legitimate check-in that already passed the geofence test above.
    const { data: fraudCheck, error: fraudCheckError } = await supabase.functions.invoke('fraud-detector', {
      body: { action: 'gps_check', employeeId: employee.id, lat: location.coords.latitude, lng: location.coords.longitude, mockLocationDetected: mockDetected },
    })

    if (!fraudCheckError && fraudCheck?.allowed === false && fraudCheck?.reason === 'mock_location_detected') {
      Alert.alert(t('common.warning'), t('worker.mockLocationDetected'))
      setIsLoading(false)
      return
    }

    const todayStr = istDateStr()
    const { data: buddyCheck } = await supabase
      .from('attendance_records')
      .select('employee_id')
      .eq('device_id', deviceId)
      .eq('date', todayStr)
      .neq('employee_id', employee.id)
      // No buddy is the normal case, and single() would call that an error.
      .maybeSingle()

    if (buddyCheck) {
      await supabase.from('fraud_flags').insert({
        employee_id: employee.id,
        flag_type: 'BUDDY_DEVICE',
        description: `Same device used by another employee today`,
      })
    }

    const grace = shift?.shift?.late_grace_minutes ?? 15
    const shiftStart = shift?.shift?.start_time
    let rawLateMinutes = 0

    if (shiftStart) {
      const [hours, minutes] = shiftStart.split(':').map(Number)
      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const nowMins = istNow.getUTCHours() * 60 + istNow.getUTCMinutes()
      const startMins = hours * 60 + minutes
      rawLateMinutes = Math.max(0, nowMins - startMins)
    }
    // effectiveLateMinutes is 0 if within grace — this is what gets stored in DB
    const effectiveLateMinutes = rawLateMinutes > grace ? rawLateMinutes : 0

    if (rawLateMinutes > grace && !lateReason) {
      setShowLateModal(true)
      setIsLoading(false)
      return
    }

    const { error: checkInError } = await checkIn(
      location.coords.latitude,
      location.coords.longitude,
      effectiveLateMinutes,
      lateReason || undefined,
      mockDetected,
      deviceId
    )
    if (checkInError) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
    }
    await refresh()
    setIsLoading(false)
  }

  const handleCheckOut = async () => {
    if (!employee) return
    if (!checklist.every(Boolean)) {
      Alert.alert(t('common.warning'), t('worker.checklistRequired'))
      return
    }

    setIsLoading(true)

    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location permission required')
      setIsLoading(false)
      return
    }

    const plant = await getPlantConfig()
    if (!plant) {
      Alert.alert(t('common.error'), 'Plant config not found')
      setIsLoading(false)
      return
    }

    const plantLocations = await getPlantLocations()
    const inside =
      plantLocations.length > 0
        ? isInsideAnyGeofence(location.coords.latitude, location.coords.longitude, plantLocations)
        : isInsideGeofence(
            location.coords.latitude,
            location.coords.longitude,
            plant.latitude,
            plant.longitude,
            plant.geofence_radius_meters
          )

    if (!inside) {
      Alert.alert(t('common.warning'), t('worker.outsidePlant'))
      setIsLoading(false)
      return
    }

    const providerStatus = await Location.getProviderStatusAsync()
    const mockDetected = !providerStatus.gpsAvailable
    if (mockDetected) {
      Alert.alert(t('common.warning'), t('worker.mockLocationDetected'))
      setIsLoading(false)
      return
    }

    await checkOut(location.coords.latitude, location.coords.longitude, shift?.shift?.end_time)
    await refresh()
    setIsLoading(false)

    // After GPS checkout: prompt exit QR scan for gate confirmation
    if (employee.requires_qr) {
      setExitQrScanned(false)
      if (hasCameraPermission === null) {
        const { status } = await BarCodeScanner.requestPermissionsAsync()
        setHasCameraPermission(status === 'granted')
      }
      setShowExitQrModal(true)
    }
  }

  const handleExitQrScanned = async ({ data }: { data: string }) => {
    if (exitQrScanned || exitQrLoading) return
    setExitQrScanned(true)
    setExitQrLoading(true)

    const plant = await getPlantConfig()
    if (!plant) {
      Alert.alert(t('common.error'), 'Plant config not found')
      setExitQrLoading(false)
      return
    }

    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location required')
      setExitQrLoading(false)
      return
    }

    const plantLocations = await getPlantLocations()
    const inside =
      plantLocations.length > 0
        ? isInsideAnyGeofence(location.coords.latitude, location.coords.longitude, plantLocations)
        : isInsideGeofence(
            location.coords.latitude,
            location.coords.longitude,
            plant.latitude,
            plant.longitude,
            plant.geofence_radius_meters
          )

    if (!inside) {
      Alert.alert(t('common.warning'), t('worker.outsidePlant'))
      setExitQrLoading(false)
      return
    }

    const expectedQr = buildQrValue(plant)
    if (data !== expectedQr) {
      Alert.alert(t('common.error'), t('worker.invalidQr'))
      setExitQrScanned(false)
      setExitQrLoading(false)
      return
    }

    const { error } = await confirmQrOut()
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      setExitQrScanned(false)
    } else {
      await refresh()
      setShowExitQrModal(false)
      Alert.alert(t('common.success'), t('worker.exitQrConfirmed'))
    }
    setExitQrLoading(false)
  }

  const submitLateReason = async () => {
    if (!lateReason.trim()) return
    setShowLateModal(false)
    await handleCheckIn()
  }

  const isCheckedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time
  const isCheckedOut = !!todayRecord?.check_out_time

  if (!employee) return <LoadingScreen />

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const checklistDone = checklist.filter(Boolean).length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <FactoryOsLink />
        <View className="p-4 gap-5">
          {/* PRIMARY ACTION — GPS check-in/out dominates the screen */}
          <View className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            <View className="flex-row items-center gap-2 px-5 py-3 border-b border-ink-100 bg-ink-50">
              <Clock size={16} color="#6B7280" />
              {shift ? (
                <Text className="text-xs text-ink-600 flex-1" numberOfLines={2}>
                  {shift.shift.name} · {shift.shift.start_time} – {shift.shift.end_time}
                </Text>
              ) : (
                <Text className="text-xs text-ink-400 flex-1" numberOfLines={2}>
                  {t('worker.noShiftAssigned')}
                </Text>
              )}
            </View>

            <View className="px-5 py-6 items-center">
              {attendanceLoading && !todayRecord ? (
                <View className="py-3 items-center">
                  <ActivityIndicator color="#E65C00" />
                  <Text className="text-sm text-ink-400 mt-3">{t('worker.checkingStatus')}</Text>
                </View>
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
          </View>

          {/* Entry QR star — shown while checked in, hidden after checkout */}
          {employee?.requires_qr && isCheckedIn && (
            todayRecord?.qr_verified ? (
              <View className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
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
                onPress={() => router.push('/(worker)/qr')}
                className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden"
              >
                <View className="px-5 py-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                    <QrCode size={22} color="#E65C00" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">{t('worker.scanQrForStar')}</Text>
                    <Text className="text-xs text-ink-500">{t('worker.scanQrForStarHint')}</Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            )
          )}

          {/* Exit QR — shown after GPS checkout, data collection until 15 Oct */}
          {employee?.requires_qr && isCheckedOut && (
            todayRecord?.check_out_qr_verified ? (
              <View className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
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
                onPress={() => {
                  setExitQrScanned(false)
                  setShowExitQrModal(true)
                }}
                className="bg-white rounded-2xl border border-brand-200 shadow-sm overflow-hidden"
              >
                <View className="px-5 py-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                    <LogOut size={22} color="#E65C00" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">{t('worker.scanExitQr')}</Text>
                    <Text className="text-xs text-ink-500">{t('worker.scanExitQrHint')}</Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            )
          )}

          {isCheckedIn && (
            <Card>
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-bold text-ink-900">{t('worker.dailyChecklist')}</Text>
                <Text className="text-xs font-semibold text-ink-500">
                  {t('worker.checklistProgress', { done: checklistDone, total: checklist.length })}
                </Text>
              </View>
              <Text className="text-xs text-ink-500 mb-3">{t('worker.checklistRequired')}</Text>
              {[
                t('worker.checklistItem1'),
                t('worker.checklistItem2'),
                t('worker.checklistItem3'),
              ].map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    const updated = [...checklist]
                    updated[index] = !updated[index]
                    setChecklist(updated)
                  }}
                  className="flex-row items-center gap-3 py-2.5"
                >
                  <View className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    checklist[index] ? 'bg-brand-600 border-brand-600' : 'border-ink-300'
                  }`}>
                    {checklist[index] && <CheckSquare size={16} color="white" />}
                  </View>
                  <Text className={`text-sm flex-1 ${checklist[index] ? 'text-ink-900 line-through' : 'text-ink-700'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          )}

          <SafetyTip />

          {/* SECONDARY — quick actions, clearly lower visual weight than the hero */}
          <View>
            <Text className="text-sm font-bold text-ink-700 mb-2 px-1">{t('common.quickActions')}</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/(worker)/5s')}
                className="flex-1 bg-white rounded-xl border border-ink-100 shadow-sm py-5 items-center justify-center"
              >
                <Camera size={22} color="#E65C00" />
                <Text className="text-xs font-semibold text-ink-900 mt-2">5S</Text>
              </TouchableOpacity>
              {employee?.requires_qr && (
                <TouchableOpacity
                  onPress={() => router.push('/(worker)/qr')}
                  className="flex-1 bg-white rounded-xl border border-ink-100 shadow-sm py-5 items-center justify-center"
                >
                  <QrCode size={22} color="#E65C00" />
                  <Text className="text-xs font-semibold text-ink-900 mt-2 text-center">{t('worker.qrCheckIn')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => router.push('/(worker)/observation')}
                className="flex-1 bg-white rounded-xl border border-ink-100 shadow-sm py-5 items-center justify-center px-1"
              >
                <AlertCircle size={22} color="#E65C00" />
                <Text className="text-xs font-semibold text-ink-900 mt-2 text-center">{t('worker.reportIssue')}</Text>
                <Text className="text-[10px] text-ink-400 mt-0.5 text-center">
                  {t('worker.observationsLeftShort', { count: Math.max(0, MAX_DAILY_OBSERVATIONS - observationCount) })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(worker)/leave')}
            className="bg-white rounded-xl border border-ink-100 shadow-sm p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                <Calendar size={18} color="#E65C00" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t('worker.leaveBalance')}</Text>
                <Text className="text-xs text-ink-500">{t('worker.manageLeave')}</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

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
            <Button title="common.cancel" onPress={() => setShowLateModal(false)} variant="ghost" />
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
              <Text className="text-sm text-ink-500 text-center">{t('worker.cameraPermissionRequired')}</Text>
            </View>
          ) : (
            <View className="flex-1 p-4">
              <Text className="text-xs text-ink-500 text-center mb-3 px-2">{t('worker.exitQrHint')}</Text>
              <View className="flex-1 rounded-2xl overflow-hidden">
                <BarCodeScanner
                  onBarCodeScanned={exitQrScanned ? undefined : handleExitQrScanned}
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
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}
