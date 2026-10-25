import React, { useEffect } from 'react'
import { View, Text, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useUnifiedNotifications } from '@/hooks/useAppNotifications'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Bell, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react-native'

/** Shared bell screen for every role group; each group's notifications.tsx is a thin wrapper. */
export function NotificationsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  // Old `notifications` rows and server-written `app_notifications` rows, merged newest-first
  const { items: notifications, isLoading, markAllRead } = useUnifiedNotifications()

  // Opening the screen marks everything read (bold/tinted state is from before this visit's load)
  const [seen, setSeen] = React.useState<Set<string>>(new Set())
  useEffect(() => {
    if (isLoading) return
    const unread = notifications.filter(n => !n.read)
    if (!unread.length) return
    setSeen(prev => new Set([...prev, ...unread.map(n => n.key)]))
    markAllRead()
  }, [isLoading])

  const getIcon = (type: string) => {
    switch (type) {
      case 'LEAVE_APPROVED':
      case 'ADVANCE_APPROVED':
      case 'advance_approved':
      case 'payslip_ready':
        return <CheckCircle size={20} color="#22C55E" />
      case 'LEAVE_REJECTED':
      case 'ADVANCE_REJECTED':
      case 'advance_rejected':
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
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={notifications}
        keyExtractor={item => item.key}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card className={`mb-2 ${!item.read || seen.has(item.key) ? 'border-brand-200 bg-brand-50' : ''}`}>
            <View className="flex-row items-start gap-3">
              {getIcon(item.type)}
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{item.title}</Text>
                <Text className="text-xs text-ink-600 mt-1">{item.body}</Text>
                <Text className="text-xs text-ink-400 mt-2">
                  {new Date(item.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Bell size={40} color="#D1D5DB" />
            <Text className="text-sm font-semibold text-ink-700 mt-3">{t('worker.notificationsEmptyTitle')}</Text>
            <Text className="text-xs text-ink-400 mt-1">{t('common.noData')}</Text>
          </View>
        }
      />
    </View>
  )
}
