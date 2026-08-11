import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { UserCheck, UserX, Clock, Users } from 'lucide-react-native'
import { STATUS, INK } from '@/components/theme'

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

  const attendancePct = stats.total > 0 ? (stats.present / stats.total) * 100 : 0

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('supervisor.teamStatus')}</Text>
        </View>

        {stats.total === 0 ? (
          <Card className="items-center py-10">
            <Users size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('common.noData')}</Text>
          </Card>
        ) : (
          <>
            <Card className="mb-4 items-center py-6">
              <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">{t('supervisor.attendanceRate')}</Text>
              <Text className="text-5xl font-bold text-brand-600 tabular-nums">{attendancePct.toFixed(1)}%</Text>
              <View className="flex-row items-center gap-1.5 mt-2">
                <Users size={14} color={INK[400]} />
                <Text className="text-sm text-ink-500">{t('supervisor.teamSize')}: {stats.total}</Text>
              </View>
            </Card>

            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('common.overview')}</Text>
            <View className="flex-row gap-3">
              <Card className="flex-1 items-center py-4">
                <View className="w-10 h-10 rounded-full bg-status-present-bg items-center justify-center mb-2"><UserCheck size={20} color={STATUS.present.fg} /></View>
                <Text className="text-2xl font-bold text-status-present tabular-nums">{stats.present}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{t('supervisor.presentCount')}</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <View className="w-10 h-10 rounded-full bg-status-absent-bg items-center justify-center mb-2"><UserX size={20} color={STATUS.absent.fg} /></View>
                <Text className="text-2xl font-bold text-status-absent tabular-nums">{stats.absent}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{t('supervisor.absentCount')}</Text>
              </Card>
              <Card className="flex-1 items-center py-4">
                <View className="w-10 h-10 rounded-full bg-status-late-bg items-center justify-center mb-2"><Clock size={20} color={STATUS.late.fg} /></View>
                <Text className="text-2xl font-bold text-status-late tabular-nums">{stats.late}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{t('supervisor.lateCount')}</Text>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
