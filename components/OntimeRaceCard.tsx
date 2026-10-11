import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { useMyOntimeRank } from '@/hooks/useOntimeRace'
import { Card } from './Card'

// Yash, 11 Oct 2026: every employee sees only their OWN rank in their group
// this month — never any other name. Hidden for the owner, when the group is
// too small to rank (rank null) and on any error.
export function OntimeRaceCard({ refreshKey }: { refreshKey?: unknown }) {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { data, error } = useMyOntimeRank(refreshKey)

  if (!employee || employee.role === 'owner') return null
  if (error || !data || data.rank == null) return null

  const categoryKey = `ontimeRace.category${data.category.charAt(0).toUpperCase()}${data.category.slice(1)}`
  const category = t(categoryKey, { defaultValue: data.category })

  return (
    <Card variant="flat" className="bg-brand-50 border-brand-200">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-white items-center justify-center mt-0.5">
          <Trophy size={18} color="#E65C00" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-brand-700 mb-1">{t('ontimeRace.cardTitle')}</Text>
          <Text className="text-base font-bold text-ink-900">
            {t('ontimeRace.youAre', { rank: data.rank, size: data.group_size, category })}
          </Text>
          <Text className="text-xs text-ink-600 mt-0.5">
            {t('ontimeRace.onTimeDays', { days: data.on_time_days })}
          </Text>
          <Text className="text-xs text-ink-500 mt-1.5">
            {data.rank === 1 ? t('ontimeRace.leading') : t('ontimeRace.keepGoing')}
          </Text>
        </View>
      </View>
    </Card>
  )
}
