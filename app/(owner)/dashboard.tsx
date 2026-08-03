import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { TrendingUp, DollarSign, Users, Award } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'
import { router } from 'expo-router'

export default function OwnerDashboard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [kpi, setKpi] = useState({ attendance: 0, production: 0, score: 0, payroll: 0, advances: 0, incentives: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const today = new Date().toISOString().split('T')[0]
      const { data: allEmps } = await supabase.from('employees').select('id').eq('is_active', true)
      const { data: attendance } = await supabase.from('attendance_records').select('status').in('employee_id', allEmps?.map(e => e.id) || []).eq('date', today)
      const present = attendance?.filter(a => a.status === 'P').length || 0
      const total = allEmps?.length || 1
      const { data: payroll } = await supabase.from('payroll_records').select('net_pay').eq('month', String(new Date().getMonth() + 1).padStart(2, '0')).eq('year', new Date().getFullYear())
      const { data: advances } = await supabase.from('advance_requests').select('amount').eq('status', 'approved')
      setKpi({
        attendance: (present / total) * 100,
        production: 85,
        score: 78,
        payroll: payroll?.reduce((s, r) => s + r.net_pay, 0) || 0,
        advances: advances?.reduce((s, r) => s + r.amount, 0) || 0,
        incentives: 0,
      })
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('owner.kpiDashboard')}</Text>
        <View className="flex-row gap-3 mb-4">
          <Card className="flex-1 items-center">
            <TrendingUp size={24} className="text-green-600 mb-1" />
            <Text className="text-2xl font-bold text-gray-900">{kpi.attendance.toFixed(1)}%</Text>
            <Text className="text-xs text-gray-500">{t('owner.attendanceKpi')}</Text>
          </Card>
          <Card className="flex-1 items-center">
            <TrendingUp size={24} className="text-blue-600 mb-1" />
            <Text className="text-2xl font-bold text-gray-900">{kpi.production}%</Text>
            <Text className="text-xs text-gray-500">{t('owner.productionKpi')}</Text>
          </Card>
          <Card className="flex-1 items-center">
            <Award size={24} className="text-orange-600 mb-1" />
            <Text className="text-2xl font-bold text-gray-900">{kpi.score}</Text>
            <Text className="text-xs text-gray-500">{t('owner.scoreKpi')}</Text>
          </Card>
        </View>

        <TouchableOpacity onPress={() => router.push('/(owner)/eotm')} className="mb-4">
          <Card className="bg-orange-50 border-orange-200">
            <View className="flex-row items-center gap-3">
              <Award size={24} className="text-orange-600" />
              <Text className="text-base font-bold text-orange-800">{t('owner.eotm')}</Text>
            </View>
          </Card>
        </TouchableOpacity>

        <Card title={t('owner.costSummary')}>
          <View className="gap-2">
            <View className="flex-row justify-between"><Text className="text-sm text-gray-600">{t('owner.payrollCost')}</Text><Text className="text-sm font-bold text-gray-900">₹{kpi.payroll.toLocaleString()}</Text></View>
            <View className="flex-row justify-between"><Text className="text-sm text-gray-600">{t('owner.advanceCost')}</Text><Text className="text-sm font-bold text-gray-900">₹{kpi.advances.toLocaleString()}</Text></View>
            <View className="flex-row justify-between"><Text className="text-sm text-gray-600">{t('owner.incentiveCost')}</Text><Text className="text-sm font-bold text-gray-900">₹{kpi.incentives.toLocaleString()}</Text></View>
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}
