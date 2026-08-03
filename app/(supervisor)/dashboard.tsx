import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { UserCheck, UserX, Clock } from 'lucide-react-native'

export default function SupervisorDashboard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchStats() }, [employee])

  const fetchStats = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data: team } = await supabase.from('employees').select('id').eq('supervisor_id', employee.id)
    if (!team) { setIsLoading(false); return }
    const ids = team.map(t => t.id)
    const { data: attendance } = await supabase.from('attendance_records').select('status').in('employee_id', ids).eq('date', today)
    const present = attendance?.filter(a => a.status === 'P').length || 0
    const absent = attendance?.filter(a => a.status === 'A').length || 0
    const late = attendance?.filter(a => a.status === 'L').length || 0
    setStats({ present, absent, late, total: ids.length })
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('supervisor.teamStatus')}</Text>
        <View className="flex-row gap-3 mb-4">
          <Card className="flex-1 items-center"><UserCheck size={24} className="text-green-600 mb-1" /><Text className="text-2xl font-bold text-green-600">{stats.present}</Text><Text className="text-xs text-gray-500">{t('supervisor.presentCount')}</Text></Card>
          <Card className="flex-1 items-center"><UserX size={24} className="text-red-600 mb-1" /><Text className="text-2xl font-bold text-red-600">{stats.absent}</Text><Text className="text-xs text-gray-500">{t('supervisor.absentCount')}</Text></Card>
          <Card className="flex-1 items-center"><Clock size={24} className="text-yellow-600 mb-1" /><Text className="text-2xl font-bold text-yellow-600">{stats.late}</Text><Text className="text-xs text-gray-500">{t('supervisor.lateCount')}</Text></Card>
        </View>
        <Card><Text className="text-sm text-gray-600">Total Team Size: {stats.total}</Text><Text className="text-sm text-gray-600">Attendance %: {stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 0}%</Text></Card>
      </ScrollView>
    </View>
  )
}
