import React, { useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router, useFocusEffect } from 'expo-router'
import { Bell, ChevronRight } from 'lucide-react-native'
import { Card } from '@/components/Card'
import { CountPill } from '@/components/CountPill'
import { BRAND } from '@/components/theme'
import { useUnifiedNotifications } from '@/hooks/useAppNotifications'

/** More-menu row for the bell, with the red unread count (old + new stores summed). */
export function NotificationsMenuRow({ group }: { group: 'owner' | 'plant-head' | 'hr-admin' | 'manager' | 'supervisor' | 'security' }) {
  const { t } = useTranslation()
  const { unreadCount, refresh } = useUnifiedNotifications()
  useFocusEffect(useCallback(() => { refresh() }, [refresh]))
  return (
    <TouchableOpacity onPress={() => router.push(`/(${group})/notifications` as any)} className="mb-2 min-h-touch">
      <Card className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <Bell size={20} color={BRAND[600]} />
          <Text className="text-base text-ink-900">{t('common.notifications')}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <CountPill count={unreadCount} />
          <ChevronRight size={18} color="#9CA3AF" />
        </View>
      </Card>
    </TouchableOpacity>
  )
}
