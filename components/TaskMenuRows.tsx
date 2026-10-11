import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { ClipboardList, Send, ChevronRight } from 'lucide-react-native'
import { Card } from '@/components/Card'
import { BRAND } from '@/components/theme'
import { useTaskBadgeStore } from '@/hooks/useAssignedTasks'

interface Props {
  /** Route group name without parentheses, e.g. 'owner', 'hr-admin'. */
  group: 'worker' | 'supervisor' | 'manager' | 'hr-admin' | 'plant-head' | 'owner' | 'security'
  /** Members and security guards cannot assign, so they only get "My Tasks". */
  canAssign: boolean
}

/** "My Tasks" (with the live count pill) + "Team Tasks" rows for a role's More screen. */
export function TaskMenuRows({ group, canAssign }: Props) {
  const { t } = useTranslation()
  const count = useTaskBadgeStore(s => s.count)
  return (
    <View>
      <TouchableOpacity onPress={() => router.push(`/(${group})/my-tasks` as any)} className="mb-2 min-h-touch">
        <Card className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <ClipboardList size={20} color={BRAND[600]} />
            <Text className="text-base text-ink-900">{t('delegatedTasks.myTasks')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {count > 0 ? (
              <View className="bg-status-rejected rounded-full min-w-[22px] px-1.5 py-0.5 items-center">
                <Text className="text-xs font-bold text-white">{count}</Text>
              </View>
            ) : null}
            <ChevronRight size={18} color="#9CA3AF" />
          </View>
        </Card>
      </TouchableOpacity>
      {canAssign ? (
        <TouchableOpacity onPress={() => router.push(`/(${group})/team-tasks` as any)} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Send size={20} color={BRAND[600]} />
              <Text className="text-base text-ink-900">{t('delegatedTasks.teamTasks')}</Text>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
          </Card>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
