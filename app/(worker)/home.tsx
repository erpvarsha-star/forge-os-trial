import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Header } from '@/components/Header'
import { SafetyTip } from '@/components/SafetyTip'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { getCurrentLocation, getPlantConfig, isInsideGeofence } from '@/lib/location'
import { supabase } from '@/lib/supabase'
import { EmployeeShift } from '@/types'
import { MAX_DAILY_OBSERVATIONS } from '@/constants'
import { MapPin, Clock, CheckSquare, AlertCircle, Camera, QrCode } from 'lucide-react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import Constants from 'expo-constants'

export default function WorkerHome() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, checkIn, checkOut, refresh } = useAttendance(employee?.id || '')
  const [shift, setShift] = useState<EmployeeShift | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showLateModal, setShowLateModal] = useState(false)
  const [lateReason, setLateReason] = useState('')
  const [checklist, setChecklist] = useState([false, false, false])
  const [observationCount, setObservationCount] = useState(0)

  useEffect(() => {
    fetchShift()
    fetchObservationCount()
  }, [employee])

  const fetchShift = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('employee_shifts')
      .select('*, shift:shifts(*)')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .single()
    if (data) setShift(data as EmployeeShift)
  }

  const fetchObservationCount = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
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

    const inside = isInsideGeofence(
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
    const deviceId = Constants.deviceId || Constants.sessionId

    const todayStr = new Date().toISOString().split('T')[0]
    const { data: buddyCheck } = await supabase
      .from('attendance_records')
      .select('employee_id')
      .eq('device_id', deviceId)
      .eq('date', todayStr)
      .neq('employee_id', employee.id)
      .single()

    if (buddyCheck) {
      await supabase.from('fraud_flags').insert({
        employee_id: employee.id,
        flag_type: 'BUDDY_DEVICE',
        description: `Same device used by another employee today`,
      })
    }

    const now = new Date()
    const shiftStart = shift?.shift?.start_time
    let lateMinutes = 0

    if (shiftStart) {
      const [hours, minutes] = shiftStart.split(':').map(Number)
      const startTime = new Date(now)
      startTime.setHours(hours, minutes, 0)
      lateMinutes = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 60000))
    }

    if (lateMinutes > 30 && !lateReason) {
      setShowLateModal(true)
      setIsLoading(false)
      return
    }

    await checkIn(location.coords.latitude, location.coords.longitude, lateReason || undefined, mockDetected, deviceId)
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

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-4">
          <SafetyTip />

          <Card title={t('worker.todaysShift')}>
            {shift ? (
              <View className="flex-row items-center gap-3">
                <Clock size={20} className="text-orange-600" />
                <View>
                  <Text className="text-base font-bold text-gray-900">{shift.shift.name}</Text>
                  <Text className="text-sm text-gray-500">
                    {shift.shift.start_time} - {shift.shift.end_time}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-sm text-gray-500">{t('common.noData')}</Text>
            )}
          </Card>

          <Card>
            <Button
              title={isCheckedOut ? 'common.checkedOut' : isCheckedIn ? 'worker.gpsCheckOut' : 'worker.gpsCheckIn'}
              onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
              loading={isLoading}
              disabled={isCheckedOut}
              variant={isCheckedIn ? 'danger' : 'primary'}
              size="lg"
              className="w-full"
              icon={<MapPin size={20} color="white" />}
            />
            {todayRecord?.check_in_time && (
              <Text className="text-xs text-gray-500 mt-2 text-center">
                {t('common.checkIn')}: {new Date(todayRecord.check_in_time).toLocaleTimeString()}
              </Text>
            )}
            {todayRecord?.check_out_time && (
              <Text className="text-xs text-gray-500 mt-1 text-center">
                {t('common.checkOut')}: {new Date(todayRecord.check_out_time).toLocaleTimeString()}
              </Text>
            )}
          </Card>

          {isCheckedIn && (
            <Card title={t('worker.dailyChecklist')}>
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
                  className="flex-row items-center gap-3 py-2"
                >
                  <View className={`w-6 h-6 rounded border-2 items-center justify-center ${
                    checklist[index] ? 'bg-orange-600 border-orange-600' : 'border-gray-300'
                  }`}>
                    {checklist[index] && <CheckSquare size={16} color="white" />}
                  </View>
                  <Text className={`text-sm ${checklist[index] ? 'text-gray-900 line-through' : 'text-gray-700'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          )}

          <Card title={t('worker.leaveBalance')}>
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-2xl font-bold text-orange-600">--</Text>
                <Text className="text-xs text-gray-500">{t('worker.earnedLeave')}</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-orange-600">--</Text>
                <Text className="text-xs text-gray-500">{t('worker.casualLeave')}</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-orange-600">--</Text>
                <Text className="text-xs text-gray-500">{t('worker.sickLeave')}</Text>
              </View>
            </View>
          </Card>

          <Card title={t('worker.maintenanceObservations')}>
            <Text className="text-sm text-gray-600 mb-3">
              {t('worker.maintenanceLimit', { count: Math.max(0, MAX_DAILY_OBSERVATIONS - observationCount) })}
            </Text>
            <Button
              title="worker.addObservation"
              onPress={() => router.push('/(worker)/observation')}
              variant="outline"
              size="sm"
              icon={<AlertCircle size={16} color="#E65C00" />}
            />
          </Card>

          <View className="flex-row gap-3">
            <Card className="flex-1">
              <TouchableOpacity onPress={() => router.push('/(worker)/5s')} className="items-center">
                <Camera size={24} className="text-orange-600 mb-2" />
                <Text className="text-sm font-medium text-gray-900">5S</Text>
              </TouchableOpacity>
            </Card>
            <Card className="flex-1">
              <TouchableOpacity onPress={() => router.push('/(worker)/qr')} className="items-center">
                <QrCode size={24} className="text-orange-600 mb-2" />
                <Text className="text-sm font-medium text-gray-900">QR</Text>
              </TouchableOpacity>
            </Card>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showLateModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('worker.lateReason')}</Text>
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
    </View>
  )
}
