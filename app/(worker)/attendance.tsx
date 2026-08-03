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
        <View className="flex-row gap-3 mb-4">
          <Card className="flex-1 items-center">
            <Text className="text-2xl font-bold text-green-600">{present}</Text>
            <Text className="text-xs text-gray-500">{t('common.present')}</Text>
          </Card>
          <Card className="flex-1 items-center">
            <Text className="text-2xl font-bold text-red-600">{absent}</Text>
            <Text className="text-xs text-gray-500">{t('common.absent')}</Text>
          </Card>
          <Card className="flex-1 items-center">
            <Text className="text-2xl font-bold text-yellow-600">{late}</Text>
            <Text className="text-xs text-gray-500">{t('common.late')}</Text>
          </Card>
        </View>
        <AttendanceCalendar records={records} month={currentMonth} year={currentYear} />
      </ScrollView>
    </View>
  )
}
