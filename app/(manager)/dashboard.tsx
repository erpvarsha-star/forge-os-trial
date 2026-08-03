import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'

export default function ManagerDashboard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [attendancePct, setAttendancePct] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchStats() }, [employee])

  const fetchStats = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data: deptEmployees } = await supabase.from('employees').select('id').eq('department', employee.department)
    if (!deptEmployees) { setIsLoading(false); return }
    const ids = deptEmployees.map(e => e.id)
    const { data: attendance } = await supabase.from('attendance_records').select('status').in('employee_id', ids).eq('date', today)
    const present = attendance?.filter(a => a.status === 'P').length || 0
    setAttendancePct(ids.length > 0 ? (present / ids.length) * 100 : 0)
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('manager.deptAttendance')}</Text>
        <Card className="items-center mb-4">
          <Text className="text-4xl font-bold text-orange-600">{attendancePct.toFixed(1)}%</Text>
          <Text className="text-sm text-gray-500">{t('manager.attendancePercent')}</Text>
        </Card>
        <Card title={t('manager.deptLeaderboard')}><Text className="text-sm text-gray-500">Leaderboard data from monthly_scores</Text></Card>
      </ScrollView>
    </View>
  )
}
