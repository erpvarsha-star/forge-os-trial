import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { FactoryOsLink } from '@/components/FactoryOsLink'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Award } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { BRAND, STATUS } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <FactoryOsLink />
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.kpiDashboard')}</Text>
        </View>

        <View className="flex-row gap-3 mb-6">
          <Card className="flex-1 items-center py-4">
            <View className="w-9 h-9 rounded-full bg-status-approved-bg items-center justify-center mb-2"><TrendingUp size={18} color={STATUS.approved.fg} /></View>
            <Text className="text-2xl font-bold text-ink-900 tabular-nums">{kpi.attendance.toFixed(1)}%</Text>
            <Text className="text-xs text-ink-500 mt-0.5 text-center">{t('owner.attendanceKpi')}</Text>
          </Card>
          <Card className="flex-1 items-center py-4">
            <View className="w-9 h-9 rounded-full bg-ink-100 items-center justify-center mb-2"><TrendingUp size={18} color="#4B5265" /></View>
            <Text className="text-2xl font-bold text-ink-900 tabular-nums">{kpi.production}%</Text>
            <Text className="text-xs text-ink-500 mt-0.5 text-center">{t('owner.productionKpi')}</Text>
          </Card>
          <Card className="flex-1 items-center py-4">
            <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center mb-2"><Award size={18} color={BRAND[600]} /></View>
            <Text className="text-2xl font-bold text-ink-900 tabular-nums">{kpi.score}</Text>
            <Text className="text-xs text-ink-500 mt-0.5 text-center">{t('owner.scoreKpi')}</Text>
          </Card>
        </View>

        <TouchableOpacity onPress={() => router.push('/(owner)/eotm')} className="mb-6 min-h-touch">
          <Card className="bg-brand-50" variant="flat">
            <View className="flex-row items-center gap-3">
              <Award size={22} color={BRAND[600]} />
              <Text className="text-base font-bold text-brand-800 flex-1">{t('owner.eotm')}</Text>
            </View>
          </Card>
        </TouchableOpacity>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('owner.costSummary')}</Text>
        <Card>
          <View className="gap-3">
            <View className="flex-row justify-between items-center"><Text className="text-sm text-ink-600">{t('owner.payrollCost')}</Text><Text className="text-base font-bold text-ink-900 font-mono tabular-nums">₹{kpi.payroll.toLocaleString()}</Text></View>
            <View className="flex-row justify-between items-center"><Text className="text-sm text-ink-600">{t('owner.advanceCost')}</Text><Text className="text-base font-bold text-ink-900 font-mono tabular-nums">₹{kpi.advances.toLocaleString()}</Text></View>
            <View className="flex-row justify-between items-center"><Text className="text-sm text-ink-600">{t('owner.incentiveCost')}</Text><Text className="text-base font-bold text-ink-900 font-mono tabular-nums">₹{kpi.incentives.toLocaleString()}</Text></View>
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}
