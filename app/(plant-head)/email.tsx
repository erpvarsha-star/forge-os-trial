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
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('plantHead.emailDashboard')}</Text>
        {tasks.map(task => (
          <Card key={task.id} className="mb-2">
            <View className="flex-row items-start gap-3">
              <Mail size={18} className="text-orange-600 mt-0.5" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{task.subject}</Text>
                <Text className="text-xs text-gray-500">{task.sender} • {task.inbox}</Text>
                <Text className="text-xs text-orange-600 mt-1">Priority: {task.priority}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
