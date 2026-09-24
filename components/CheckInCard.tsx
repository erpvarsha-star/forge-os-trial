import React, { useState, useEffect } from 'react'
import { View, Text, Alert, Modal, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'
import {
  getCurrentLocation,
  getPlantConfig,
  isInsideGeofence,
  getPlantLocations,
  isInsideAnyGeofence,
} from '@/lib/location'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import { MapPin, CheckCircle2, QrCode, Star, X } from 'lucide-react-native'
import * as Location from 'expo-location'
import { BarCodeScanner } from 'expo-barcode-scanner'

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
  const { todayRecord, checkIn, checkOut, confirmQr, refresh, isLoading: attendanceLoading } = useAttendance(
    employee?.id || ''
  )
  const [isLoading, setIsLoading] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState('')

  const [showQrModal, setShowQrModal] = useState(false)
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)

  useEffect(() => {
    if (!showQrModal || hasCameraPermission !== null) return
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => setHasCameraPermission(status === 'granted'))
  }, [showQrModal])

  const openQrModal = () => {
    setScanned(false)
    setShowQrModal(true)
  }

  const handleQrScanned = async ({ data }: { data: string }) => {
    if (scanned || qrLoading || !employee) return
    setScanned(true)
    setQrLoading(true)

    const plant = await getPlantConfig()
    if (!plant) {
      Alert.alert(t('common.error'), 'Plant config not found')
      setQrLoading(false)
      return
    }

    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location required')
      setQrLoading(false)
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
      setQrLoading(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const expectedQr = `${plant.id}-${today}-${plant.qr_secret_salt}`

    if (data !== expectedQr) {
      Alert.alert(t('common.error'), t('worker.invalidQr'))
      setQrLoading(false)
      setScanned(false)
      return
    }

    const { error } = await confirmQr()
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      setScanned(false)
    } else {
      await refresh()
      setShowQrModal(false)
      Alert.alert(t('common.success'), t('worker.qrConfirmedBody'))
    }
    setQrLoading(false)
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

    const plantLocations = await getPlantLocations()
    const inside =
      plantLocations.length > 0
        ? isInsideAnyGeofence(
            location.coords.latitude,
            location.coords.longitude,
            plantLocations
          )
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
    const deviceId = await getDeviceId()

    const { data: fraudCheck, error: fraudCheckError } = await supabase.functions.invoke(
      'fraud-detector',
      {
        body: {
          action: 'gps_check',
          employeeId: employee.id,
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          mockLocationDetected: mockDetected,
        },
      }
    )

    if (
      !fraudCheckError &&
      fraudCheck?.allowed === false &&
      fraudCheck?.reason === 'mock_location_detected'
    ) {
      Alert.alert(t('common.warning'), t('worker.mockLocationDetected'))
      setIsLoading(false)
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const { data: buddyCheck } = await supabase
      .from('attendance_records')
      .select('employee_id')
      .eq('device_id', deviceId)
      .eq('date', todayStr)
      .neq('employee_id', employee.id)
      .maybeSingle()

    if (buddyCheck) {
      await supabase.from('fraud_flags').insert({
        employee_id: employee.id,
        flag_type: 'BUDDY_DEVICE',
        description: 'Same device used by another employee today',
      })
    }

    const { data: shiftData } = await supabase
      .from('employee_shifts')
      .select('*, shift:shifts(*)')
      .eq('employee_id', employee.id)
      .eq('date', todayStr)
      .maybeSingle()

    const now = new Date()
    let lateMinutes = 0
    if (shiftData?.shift?.start_time) {
      const [hours, minutes] = (shiftData.shift.start_time as string).split(':').map(Number)
      const startTime = new Date(now)
      startTime.setHours(hours, minutes, 0)
      lateMinutes = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 60000))
    }

    if (lateMinutes > 30 && !lateReason) {
      setShowLateModal(true)
      setIsLoading(false)
      return
    }

    await checkIn(
      location.coords.latitude,
      location.coords.longitude,
      lateReason || undefined,
      mockDetected,
      deviceId
    )
    await refresh()
    setLateReason('')
    setIsLoading(false)
  }

  const handleCheckOut = async () => {
    if (!employee) return
    setIsLoading(true)
    const location = await getCurrentLocation()
    if (!location) {
      Alert.alert(t('common.error'), 'Location permission required')
      setIsLoading(false)
      return
    }
    await checkOut(location.coords.latitude, location.coords.longitude)
    await refresh()
    setIsLoading(false)
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

      {(isCheckedIn || isCheckedOut) && (
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
              <Text className="text-sm text-ink-500 text-center">{t('worker.cameraPermissionRequired')}</Text>
            </View>
          ) : (
            <View className="flex-1 p-4">
              <Text className="text-xs text-ink-500 text-center mb-3 px-2">{t('worker.qrHint')}</Text>
              <Card className="flex-1 items-center justify-center">
                <View className="w-full h-full">
                  <BarCodeScanner
                    onBarCodeScanned={scanned ? undefined : handleQrScanned}
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
    </>
  )
}
