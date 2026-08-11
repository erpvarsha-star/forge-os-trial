import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MaintenanceObservation } from '@/types'
import { CheckSquare, ClipboardList, Users, Wrench, ClipboardCheck } from 'lucide-react-native'
import { router } from 'expo-router'
import { BRAND, INK } from '@/components/theme'

export default function SupervisorTasks() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceObservation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchTasks() }, [employee])

  const fetchTasks = async () => {
    if (!employee) return
    const { data } = await supabase.from('maintenance_observations').select('*').eq('status', 'open').order('created_at', { ascending: false })
    if (data) setMaintenanceTasks(data as MaintenanceObservation[])
    setIsLoading(false)
  }

  const markComplete = async (id: string) => {
    await supabase.from('maintenance_observations').update({ status: 'resolved' }).eq('id', id)
    fetchTasks()
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const quickActions = [
    { key: 'shift-report', label: 'supervisor.shiftReport', icon: <ClipboardList size={20} color={BRAND[600]} />, path: '/(supervisor)/shift-report' },
    { key: 'casual-workers', label: 'supervisor.casualWorkerLog', icon: <Users size={20} color={BRAND[600]} />, path: '/(supervisor)/casual-workers' },
    { key: '5s-verify', label: 'supervisor.5sVerification', icon: <CheckSquare size={20} color={BRAND[600]} />, path: '/(supervisor)/5s-verify' },
  ] as const

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.tasks')}</Text>
        </View>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('common.quickActions')}</Text>
        <View className="flex-row gap-3 mb-6">
          {quickActions.map(action => (
            <TouchableOpacity key={action.key} onPress={() => router.push(action.path as any)} className="flex-1 min-h-touch">
              <Card className="items-center py-4 flex-1">
                <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center mb-2">{action.icon}</View>
                <Text className="text-xs font-semibold text-ink-700 text-center">{t(action.label)}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t('supervisor.maintenanceTasks')}</Text>
          {maintenanceTasks.length > 0 && (
            <View className="bg-status-pending-bg px-2.5 py-0.5 rounded-full">
              <Text className="text-xs font-bold text-status-pending">{maintenanceTasks.length}</Text>
            </View>
          )}
        </View>

        {maintenanceTasks.length === 0 ? (
          <Card className="items-center py-10">
            <Wrench size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('supervisor.noOpenTasks')}</Text>
          </Card>
        ) : (
          maintenanceTasks.map(task => (
            <Card key={task.id} className="mb-3">
              <View className="flex-row justify-between items-start gap-3">
                <View className="flex-row items-start gap-3 flex-1">
                  <View className="w-9 h-9 rounded-full bg-ink-100 items-center justify-center mt-0.5"><ClipboardCheck size={16} color={INK[500]} /></View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">{task.area}</Text>
                    <Text className="text-xs text-ink-500 mt-1">{task.issue_description}</Text>
                  </View>
                </View>
              </View>
              <Button title="supervisor.markComplete" onPress={() => markComplete(task.id)} variant="outline" size="sm" icon={<CheckSquare size={14} color={BRAND[600]} />} className="mt-3 self-start" />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
