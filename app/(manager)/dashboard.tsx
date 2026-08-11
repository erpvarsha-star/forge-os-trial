import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Trophy } from 'lucide-react-native'
import { INK } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('manager.deptAttendance')}</Text>
          {!!employee.department && <Text className="text-sm text-ink-500 mt-0.5">{employee.department}</Text>}
        </View>

        <Card className="items-center mb-6 py-6">
          <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">{t('manager.attendancePercent')}</Text>
          <Text className="text-5xl font-bold text-brand-600 tabular-nums">{attendancePct.toFixed(1)}%</Text>
        </Card>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('manager.deptLeaderboard')}</Text>
        <Card className="items-center py-8">
          <Trophy size={28} color={INK[300]} />
          <Text className="text-sm font-semibold text-ink-500 mt-3">{t('common.comingSoon')}</Text>
          <Text className="text-xs text-ink-400 mt-1 text-center">{t('common.notConnectedYet')}</Text>
        </Card>
      </ScrollView>
    </View>
  )
}
