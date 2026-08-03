import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MaintenanceObservation } from '@/types'
import { CheckSquare, ClipboardList, AlertCircle } from 'lucide-react-native'
import { router } from 'expo-router'

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
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <TouchableOpacity onPress={() => router.push('/(supervisor)/shift-report')} className="mb-4">
          <Card className="bg-orange-50 border-orange-200">
            <View className="flex-row items-center gap-3"><ClipboardList size={24} className="text-orange-600" /><Text className="text-base font-bold text-orange-800">{t('supervisor.shiftReport')}</Text></View>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(supervisor)/casual-workers')} className="mb-4">
          <Card className="bg-blue-50 border-blue-200">
            <View className="flex-row items-center gap-3"><AlertCircle size={24} className="text-blue-600" /><Text className="text-base font-bold text-blue-800">{t('supervisor.casualWorkerLog')}</Text></View>
          </Card>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(supervisor)/5s-verify')} className="mb-4">
          <Card className="bg-green-50 border-green-200">
            <View className="flex-row items-center gap-3"><CheckSquare size={24} className="text-green-600" /><Text className="text-base font-bold text-green-800">{t('supervisor.5sVerification')}</Text></View>
          </Card>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 mb-2">{t('supervisor.maintenanceTasks')}</Text>
        {maintenanceTasks.map(task => (
          <Card key={task.id} className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{task.area}</Text>
                <Text className="text-xs text-gray-600 mt-1">{task.issue_description}</Text>
              </View>
              <Button title="supervisor.markComplete" onPress={() => markComplete(task.id)} variant="outline" size="sm" icon={<CheckSquare size={14} color="#E65C00" />} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
