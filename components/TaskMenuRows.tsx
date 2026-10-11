import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { ClipboardList, Send, ChevronRight } from 'lucide-react-native'
import { Card } from '@/components/Card'
import { BRAND } from '@/components/theme'
import { useActionCountsStore } from '@/hooks/useAssignedTasks'
import { CountPill } from '@/components/CountPill'

interface Props {
  /** Route group name without parentheses, e.g. 'owner', 'hr-admin'. */
  group: 'worker' | 'supervisor' | 'manager' | 'hr-admin' | 'plant-head' | 'owner' | 'security'
  /** Members and security guards cannot assign, so they only get "My Tasks". */
  canAssign: boolean
  /** True when Tasks is already a bottom tab for this role, so no Team Tasks row. */
  teamTasksIsTab?: boolean
}

/** "My Tasks" (with the live count pill) + "Team Tasks" rows for a role's More screen. */
export function TaskMenuRows({ group, canAssign, teamTasksIsTab }: Props) {
  const { t } = useTranslation()
  const todo = useActionCountsStore(s => s.counts.tasks_todo)
  const toConfirm = useActionCountsStore(s => s.counts.tasks_to_confirm)
  return (
    <View>
      <TouchableOpacity onPress={() => router.push(`/(${group})/my-tasks` as any)} className="mb-2 min-h-touch">
        <Card className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <ClipboardList size={20} color={BRAND[600]} />
            <Text className="text-base text-ink-900">{t('delegatedTasks.myTasks')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <CountPill count={todo} />
            <ChevronRight size={18} color="#9CA3AF" />
          </View>
        </Card>
      </TouchableOpacity>
      {canAssign && !teamTasksIsTab ? (
        <TouchableOpacity onPress={() => router.push(`/(${group})/team-tasks` as any)} className="mb-2 min-h-touch">
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <Send size={20} color={BRAND[600]} />
              <Text className="text-base text-ink-900">{t('delegatedTasks.teamTasks')}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <CountPill count={toConfirm} />
              <ChevronRight size={18} color="#9CA3AF" />
            </View>
          </Card>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
