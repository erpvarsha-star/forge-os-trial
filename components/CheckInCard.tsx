import React, { useState } from 'react'
import { View, Text, Alert, Modal, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import {
  getCurrentLocation,
  getPlantConfig,
  isInsideGeofence,
  getPlantLocations,
  isInsideAnyGeofence,
} from '@/lib/location'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import { MapPin, CheckCircle2 } from 'lucide-react-native'
import * as Location from 'expo-location'

export function CheckInCard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, checkIn, checkOut, refresh, isLoading: attendanceLoading } = useAttendance(
    employee?.id || ''
  )
  const [isLoading, setIsLoading] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState('')

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
