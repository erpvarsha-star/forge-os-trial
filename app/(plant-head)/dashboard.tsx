import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, TrendingUp } from 'lucide-react-native'

export default function PlantHeadDashboard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [plantStats, setPlantStats] = useState({ total: 0, present: 0, absent: 0, late: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchStats() }, [employee])

  const fetchStats = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]
    const { data: allEmployees } = await supabase.from('employees').select('id').eq('is_active', true)
    if (!allEmployees) { setIsLoading(false); return }
    const ids = allEmployees.map(e => e.id)
    const { data: attendance } = await supabase.from('attendance_records').select('status').in('employee_id', ids).eq('date', today)
    const present = attendance?.filter(a => a.status === 'P').length || 0
    const absent = attendance?.filter(a => a.status === 'A').length || 0
    const late = attendance?.filter(a => a.status === 'L').length || 0
    setPlantStats({ total: ids.length, present, absent, late })
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  const pct = plantStats.total > 0 ? (plantStats.present / plantStats.total) * 100 : 0

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('plantHead.plantAttendance')}</Text>
        <Card className="mb-4">
          <View className="flex-row items-center gap-3 mb-3"><TrendingUp size={24} className="text-orange-600" /><Text className="text-3xl font-bold text-gray-900">{pct.toFixed(1)}%</Text></View>
          <View className="flex-row justify-between"><Text className="text-sm text-gray-600">Total: {plantStats.total}</Text><Text className="text-sm text-green-600">Present: {plantStats.present}</Text><Text className="text-sm text-red-600">Absent: {plantStats.absent}</Text></View>
        </Card>
        {pct < 70 && <Card className="mb-4 bg-red-50 border-red-200"><View className="flex-row items-center gap-2"><AlertTriangle size={20} className="text-red-600" /><Text className="text-sm text-red-600 font-bold">{t('plantHead.coverageAlert')}</Text></View></Card>}
        <Card title={t('plantHead.plantScoreOverview')}><Text className="text-sm text-gray-500">Plant-wide score data</Text></Card>
      </ScrollView>
    </View>
  )
}
