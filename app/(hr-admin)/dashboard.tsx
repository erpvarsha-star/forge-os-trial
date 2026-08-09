import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'
import { Users, AlertCircle, CreditCard, Calendar } from 'lucide-react-native'

interface DashboardStats {
  totalEmployees: number
  presentToday: number
  pendingAdvances: number
  pendingLeaves: number
  missingDataCount: number
}

export default function HrAdminDashboard() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    presentToday: 0,
    pendingAdvances: 0,
    pendingLeaves: 0,
    missingDataCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchStats() }, [employee])

  const fetchStats = async () => {
    if (!employee) return
    const today = new Date().toISOString().split('T')[0]

    const [
      { count: totalEmployees },
      { count: presentToday },
      { count: pendingAdvances },
      { count: pendingLeaves },
      { count: missingDataCount },
    ] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendance_records').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'P'),
      supabase.from('advance_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true).or('name.is.null,phone.is.null,department.is.null'),
    ])

    setStats({
      totalEmployees: totalEmployees ?? 0,
      presentToday: presentToday ?? 0,
      pendingAdvances: pendingAdvances ?? 0,
      pendingLeaves: pendingLeaves ?? 0,
      missingDataCount: missingDataCount ?? 0,
    })
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />

  const attendancePct = stats.totalEmployees > 0
    ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(1)
    : '0.0'

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('hrAdmin.employeeMaster')}</Text>

        <View className="flex-row gap-3 mb-3">
          <Card className="flex-1 items-center py-4">
            <Text className="text-3xl font-bold text-orange-600">{stats.totalEmployees}</Text>
            <Text className="text-xs text-gray-500 mt-1 text-center">{t('common.total')} {t('common.name')}</Text>
          </Card>
          <Card className="flex-1 items-center py-4">
            <Text className="text-3xl font-bold text-green-600">{attendancePct}%</Text>
            <Text className="text-xs text-gray-500 mt-1 text-center">{t('common.present')} {t('common.date')}</Text>
          </Card>
        </View>

        <TouchableOpacity onPress={() => router.push('/(hr-admin)/missing-data')}>
          <Card className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <AlertCircle size={20} color={stats.missingDataCount > 0 ? '#DC2626' : '#9CA3AF'} />
              <Text className="text-base font-medium text-gray-900">{t('hrAdmin.missingData')}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${stats.missingDataCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Text className={`text-sm font-bold ${stats.missingDataCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                {stats.missingDataCount}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(hr-admin)/advance-ledger')}>
          <Card className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <CreditCard size={20} color="#E65C00" />
              <Text className="text-base font-medium text-gray-900">{t('hrAdmin.advanceLedger')}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${stats.pendingAdvances > 0 ? 'bg-orange-100' : 'bg-gray-100'}`}>
              <Text className={`text-sm font-bold ${stats.pendingAdvances > 0 ? 'text-orange-700' : 'text-gray-500'}`}>
                {stats.pendingAdvances} {t('common.pending')}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(hr-admin)/shifts')}>
          <Card className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Calendar size={20} color="#E65C00" />
              <Text className="text-base font-medium text-gray-900">{t('hrAdmin.shiftPlanning')}</Text>
            </View>
            <Text className="text-sm text-gray-500">{t('common.view')}</Text>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(hr-admin)/new-employee-flow')}>
          <Card className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Users size={20} color="#E65C00" />
              <Text className="text-base font-medium text-gray-900">{t('hrAdmin.newEmployeeFlow')}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${stats.pendingLeaves > 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
              <Text className={`text-sm font-bold ${stats.pendingLeaves > 0 ? 'text-yellow-700' : 'text-gray-500'}`}>
                {stats.pendingLeaves} {t('common.pending')}
              </Text>
            </View>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}
