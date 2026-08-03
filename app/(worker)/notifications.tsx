import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native'

interface AppNotification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
}

export default function NotificationsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [employee])

  const fetchNotifications = async () => {
    if (!employee) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', employee.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setNotifications(data as AppNotification[])
    setIsLoading(false)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'LEAVE_APPROVED':
      case 'ADVANCE_APPROVED':
        return <CheckCircle size={20} color="#22C55E" />
      case 'LEAVE_REJECTED':
      case 'ADVANCE_REJECTED':
        return <XCircle size={20} color="#EF4444" />
      case 'FRAUD_ALERT':
        return <AlertTriangle size={20} color="#EF4444" />
      default:
        return <Info size={20} color="#E65C00" />
    }
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card className={`mb-2 ${!item.read ? 'border-orange-200 bg-orange-50' : ''}`}>
            <View className="flex-row items-start gap-3">
              {getIcon(item.type)}
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{item.title}</Text>
                <Text className="text-xs text-gray-600 mt-1">{item.body}</Text>
                <Text className="text-xs text-gray-400 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Bell size={40} color="#D1D5DB" />
            <Text className="text-sm text-gray-500 mt-2">{t('common.noData')}</Text>
          </View>
        }
      />
    </View>
  )
}
