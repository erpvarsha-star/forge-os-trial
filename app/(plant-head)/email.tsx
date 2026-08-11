import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { EmailTask } from '@/types'
import { Mail, Inbox } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

export default function PlantHeadEmail() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [tasks, setTasks] = useState<EmailTask[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { data } = await supabase.from('email_tasks').select('*').eq('status', 'unread').order('priority', { ascending: false }).limit(20)
      if (data) setTasks(data as EmailTask[])
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
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('plantHead.emailDashboard')}</Text>
          {tasks.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{tasks.length}</Text>
            </View>
          )}
        </View>

        {tasks.length === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('plantHead.noEmailTasks')}</Text>
          </Card>
        ) : (
          tasks.map(task => (
            <Card key={task.id} className="mb-3">
              <View className="flex-row items-start gap-3">
                <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center mt-0.5"><Mail size={16} color={BRAND[600]} /></View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink-900">{task.subject}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5">{task.sender} • {task.inbox}</Text>
                </View>
                <View className="bg-brand-50 rounded-full px-2 py-0.5">
                  <Text className="text-xs font-bold text-brand-700">{t('plantHead.priorityLabel')} {task.priority}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
