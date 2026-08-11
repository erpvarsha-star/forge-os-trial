import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, TrendingUp, UserCheck, UserX, Clock, Trophy } from 'lucide-react-native'
import { STATUS, INK } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  const pct = plantStats.total > 0 ? (plantStats.present / plantStats.total) * 100 : 0

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('plantHead.plantAttendance')}</Text>
        </View>

        {pct < 70 && plantStats.total > 0 && (
          <Card className="mb-4 bg-status-rejected-bg" variant="flat">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={18} color={STATUS.rejected.fg} />
              <Text className="text-sm font-bold text-status-rejected flex-1">{t('plantHead.coverageAlert')}</Text>
            </View>
          </Card>
        )}

        <Card className="mb-4 items-center py-6">
          <View className="flex-row items-center gap-2 mb-1">
            <TrendingUp size={18} color={STATUS.approved.fg} />
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t('common.attendance')}</Text>
          </View>
          <Text className="text-5xl font-bold text-brand-600 tabular-nums">{pct.toFixed(1)}%</Text>
          <Text className="text-sm text-ink-500 mt-2">{t('common.total')}: {plantStats.total}</Text>
        </Card>

        <View className="flex-row gap-3 mb-6">
          <Card className="flex-1 items-center py-4">
            <View className="w-10 h-10 rounded-full bg-status-present-bg items-center justify-center mb-2"><UserCheck size={20} color={STATUS.present.fg} /></View>
            <Text className="text-2xl font-bold text-status-present tabular-nums">{plantStats.present}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{t('common.present')}</Text>
          </Card>
          <Card className="flex-1 items-center py-4">
            <View className="w-10 h-10 rounded-full bg-status-absent-bg items-center justify-center mb-2"><UserX size={20} color={STATUS.absent.fg} /></View>
            <Text className="text-2xl font-bold text-status-absent tabular-nums">{plantStats.absent}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{t('common.absent')}</Text>
          </Card>
          <Card className="flex-1 items-center py-4">
            <View className="w-10 h-10 rounded-full bg-status-late-bg items-center justify-center mb-2"><Clock size={20} color={STATUS.late.fg} /></View>
            <Text className="text-2xl font-bold text-status-late tabular-nums">{plantStats.late}</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{t('common.late')}</Text>
          </Card>
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('plantHead.plantScoreOverview')}</Text>
        <Card className="items-center py-8">
          <Trophy size={28} color={INK[300]} />
          <Text className="text-sm font-semibold text-ink-500 mt-3">{t('common.comingSoon')}</Text>
          <Text className="text-xs text-ink-400 mt-1 text-center">{t('common.notConnectedYet')}</Text>
        </Card>
      </ScrollView>
    </View>
  )
}
