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
import { MapPin, Clock, CheckSquare, AlertCircle, Camera, QrCode, CheckCircle2, Calendar, ChevronRight } from 'lucide-react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import Constants from 'expo-constants'
import { ActivityIndicator } from 'react-native'

export default function WorkerHome() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { todayRecord, checkIn, checkOut, refresh, isLoading: attendanceLoading } = useAttendance(employee?.id || '')
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

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const checklistDone = checklist.filter(Boolean).length

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-5">
          {/* PRIMARY ACTION — GPS check-in/out dominates the screen */}
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <View className="flex-row items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <Clock size={16} color="#6B7280" />
              {shift ? (
                <Text className="text-xs text-gray-600 flex-1" numberOfLines={2}>
                  {shift.shift.name} · {shift.shift.start_time} – {shift.shift.end_time}
                </Text>
              ) : (
                <Text className="text-xs text-gray-400 flex-1" numberOfLines={2}>
                  {t('worker.noShiftAssigned')}
                </Text>
              )}
            </View>

            <View className="px-5 py-6 items-center">
              {attendanceLoading && !todayRecord ? (
                <View className="py-3 items-center">
                  <ActivityIndicator color="#E65C00" />
                  <Text className="text-sm text-gray-400 mt-3">{t('worker.checkingStatus')}</Text>
                </View>
              ) : isCheckedOut ? (
                <View className="items-center">
                  <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mb-3">
                    <CheckCircle2 size={28} color="#16A34A" />
                  </View>
                  <Text className="text-base font-bold text-gray-900 mb-2 text-center">
                    {t('worker.shiftComplete')}
                  </Text>
                  {todayRecord?.check_in_time && (
                    <Text className="text-xs text-gray-500 text-center">
                      {t('worker.checkedInAt', { time: formatTime(todayRecord.check_in_time) })}
                    </Text>
                  )}
                  {todayRecord?.check_out_time && (
                    <Text className="text-xs text-gray-500 text-center">
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
                    <Text className="text-xs text-gray-500 mt-3 text-center">
                      {t('worker.checkedInAt', { time: formatTime(todayRecord.check_in_time) })}
                    </Text>
                  ) : (
                    <Text className="text-xs text-gray-400 mt-3 text-center">
                      {t('worker.tapWhenInsidePlant')}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>

          {isCheckedIn && (
            <Card>
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-bold text-gray-900">{t('worker.dailyChecklist')}</Text>
                <Text className="text-xs font-semibold text-gray-500">
                  {t('worker.checklistProgress', { done: checklistDone, total: checklist.length })}
                </Text>
              </View>
              <Text className="text-xs text-gray-500 mb-3">{t('worker.checklistRequired')}</Text>
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
                    checklist[index] ? 'bg-orange-600 border-orange-600' : 'border-gray-300'
                  }`}>
                    {checklist[index] && <CheckSquare size={16} color="white" />}
                  </View>
                  <Text className={`text-sm flex-1 ${checklist[index] ? 'text-gray-900 line-through' : 'text-gray-700'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </Card>
          )}

          <SafetyTip />

          {/* SECONDARY — quick actions, clearly lower visual weight than the hero */}
          <View>
            <Text className="text-sm font-bold text-gray-700 mb-2 px-1">{t('common.quickActions')}</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/(worker)/5s')}
                className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm py-5 items-center justify-center"
              >
                <Camera size={22} color="#E65C00" />
                <Text className="text-xs font-semibold text-gray-900 mt-2">{t('common.observation') === t('common.observation') ? '5S' : '5S'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(worker)/qr')}
                className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm py-5 items-center justify-center"
              >
                <QrCode size={22} color="#E65C00" />
                <Text className="text-xs font-semibold text-gray-900 mt-2 text-center">{t('worker.qrCheckIn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(worker)/observation')}
                className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm py-5 items-center justify-center px-1"
              >
                <AlertCircle size={22} color="#E65C00" />
                <Text className="text-xs font-semibold text-gray-900 mt-2 text-center">{t('worker.reportIssue')}</Text>
                <Text className="text-[10px] text-gray-400 mt-0.5 text-center">
                  {t('worker.observationsLeftShort', { count: Math.max(0, MAX_DAILY_OBSERVATIONS - observationCount) })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(worker)/leave')}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center">
                <Calendar size={18} color="#E65C00" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{t('worker.leaveBalance')}</Text>
                <Text className="text-xs text-gray-500">{t('worker.manageLeave')}</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>
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
