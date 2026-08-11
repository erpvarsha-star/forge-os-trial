import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'
import { Users, AlertCircle, CreditCard, Calendar, ChevronRight } from 'lucide-react-native'
import { BRAND, STATUS, INK } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  const attendancePct = stats.totalEmployees > 0
    ? ((stats.presentToday / stats.totalEmployees) * 100).toFixed(1)
    : '0.0'

  const rows = [
    {
      key: 'missing-data',
      icon: <AlertCircle size={20} color={stats.missingDataCount > 0 ? STATUS.rejected.fg : INK[400]} />,
      label: t('hrAdmin.missingData'),
      path: '/(hr-admin)/missing-data',
      badge: stats.missingDataCount,
      badgeTone: stats.missingDataCount > 0 ? 'rejected' : 'neutral',
    },
    {
      key: 'advance-ledger',
      icon: <CreditCard size={20} color={BRAND[600]} />,
      label: t('hrAdmin.advanceLedger'),
      path: '/(hr-admin)/advance-ledger',
      badge: stats.pendingAdvances,
      badgeTone: stats.pendingAdvances > 0 ? 'pending' : 'neutral',
    },
    {
      key: 'shifts',
      icon: <Calendar size={20} color={BRAND[600]} />,
      label: t('hrAdmin.shiftPlanning'),
      path: '/(hr-admin)/shifts',
      badge: null,
      badgeTone: 'neutral' as const,
    },
    {
      key: 'new-employee-flow',
      icon: <Users size={20} color={BRAND[600]} />,
      label: t('hrAdmin.newEmployeeFlow'),
      path: '/(hr-admin)/new-employee-flow',
      badge: stats.pendingLeaves,
      badgeTone: stats.pendingLeaves > 0 ? 'pending' : 'neutral',
    },
  ] as const

  const badgeClasses: Record<string, { bg: string; text: string }> = {
    rejected: { bg: 'bg-status-rejected-bg', text: 'text-status-rejected' },
    pending: { bg: 'bg-status-pending-bg', text: 'text-status-pending' },
    neutral: { bg: 'bg-ink-100', text: 'text-ink-500' },
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.employeeMaster')}</Text>
        </View>

        <View className="flex-row gap-3 mb-6">
          <Card className="flex-1 items-center py-5">
            <Text className="text-3xl font-bold text-brand-600 tabular-nums">{stats.totalEmployees}</Text>
            <Text className="text-xs text-ink-500 mt-1 text-center">{t('common.total')} {t('common.name')}</Text>
          </Card>
          <Card className="flex-1 items-center py-5">
            <Text className="text-3xl font-bold text-status-approved tabular-nums">{attendancePct}%</Text>
            <Text className="text-xs text-ink-500 mt-1 text-center">{t('common.present')} {t('common.date')}</Text>
          </Card>
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('common.overview')}</Text>
        {rows.map(row => (
          <TouchableOpacity key={row.key} onPress={() => router.push(row.path as any)} className="mb-3 min-h-touch">
            <Card className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                {row.icon}
                <Text className="text-base font-medium text-ink-900 flex-1">{row.label}</Text>
              </View>
              {row.badge !== null ? (
                <View className={`px-2.5 py-1 rounded-full ${badgeClasses[row.badgeTone].bg}`}>
                  <Text className={`text-sm font-bold ${badgeClasses[row.badgeTone].text}`}>
                    {row.badge} {row.badge > 0 ? t('common.pending') : ''}
                  </Text>
                </View>
              ) : (
                <ChevronRight size={18} color="#B9C0CC" />
              )}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}
