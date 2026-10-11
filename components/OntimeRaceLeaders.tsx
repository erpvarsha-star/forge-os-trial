import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import { useOntimeRaceLeaders } from '@/hooks/useOntimeRace'

// Owner-only: who is #1 in each (location, category) group this IST month.
export function OntimeRaceLeaders() {
  const { t, i18n } = useTranslation()
  const { leaders, error, isLoading } = useOntimeRaceLeaders()

  if (isLoading) return <ActivityIndicator className="mt-8" />
  if (error) {
    return <Text className="text-sm text-red-600">{t('ontimeRace.error')}: {error}</Text>
  }
  if (leaders.length === 0) {
    return <Text className="text-sm text-ink-500">{t('ontimeRace.empty')}</Text>
  }

  // month is 'YYYY-MM-DD' (first of the IST month) — format in UTC to avoid device-timezone drift.
  const [y, m] = leaders[0].month.split('-').map(Number)
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(
    i18n.language === 'hi' ? 'hi-IN' : 'en-IN',
    { month: 'long', year: 'numeric', timeZone: 'UTC' }
  )

  return (
    <View>
      <Text className="text-sm font-semibold text-ink-700 mb-3">{t('ontimeRace.month')}: {monthLabel}</Text>
      {leaders.map(l => {
        const cat = t(`ontimeRace.category${l.category.charAt(0).toUpperCase()}${l.category.slice(1)}`, { defaultValue: l.category })
        return (
          <Card key={`${l.work_location}-${l.category}-${l.emp_code}`} className="mb-3">
            <Text className="text-xs font-semibold text-brand-700 mb-1">{l.work_location} · {cat} · #1</Text>
            <Text className="text-base font-bold text-ink-900">{l.name}</Text>
            <Text className="text-xs text-ink-500 mb-1">{l.emp_code}{l.department ? ` · ${l.department}` : ''}</Text>
            <Text className="text-xs text-ink-700">
              {t('ontimeRace.onTimeDays', { days: l.on_time_days })} · {t('ontimeRace.lateDays')}: {l.late_days} · {t('ontimeRace.groupSize')}: {l.group_size}
            </Text>
          </Card>
        )
      })}
    </View>
  )
}
