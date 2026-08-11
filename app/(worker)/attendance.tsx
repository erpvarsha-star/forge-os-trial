import React, { useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAttendance } from '@/hooks/useAttendance'
import { Header } from '@/components/Header'
import { AttendanceCalendar } from '@/components/AttendanceCalendar'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Card } from '@/components/Card'

export default function WorkerAttendance() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [currentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear] = useState(new Date().getFullYear())
  const { records, isLoading } = useAttendance(employee?.id || '', String(currentMonth).padStart(2, '0'), currentYear)

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const present = records.filter(r => r.status === 'P').length
  const absent = records.filter(r => r.status === 'A').length
  const late = records.filter(r => r.status === 'L').length

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-sm font-bold text-gray-700 mb-2 px-1">{t('common.thisMonth')}</Text>
        <Card className="mb-5">
          <View className="flex-row">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-green-600">{present}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{t('common.present')}</Text>
            </View>
            <View className="w-px bg-gray-100" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-red-600">{absent}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{t('common.absent')}</Text>
            </View>
            <View className="w-px bg-gray-100" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-yellow-600">{late}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{t('common.late')}</Text>
            </View>
          </View>
        </Card>

        {records.length === 0 && (
          <Text className="text-xs text-gray-400 text-center mb-3">
            {t('worker.noAttendanceThisMonth')}
          </Text>
        )}

        <AttendanceCalendar records={records} month={currentMonth} year={currentYear} />
      </ScrollView>
    </View>
  )
}
