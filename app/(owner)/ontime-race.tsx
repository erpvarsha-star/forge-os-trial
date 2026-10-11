import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OntimeRaceLeaders } from '@/components/OntimeRaceLeaders'

export default function OntimeRaceScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('ontimeRace.title')}</Text>
        <Text className="text-sm text-ink-500 mb-5">{t('ontimeRace.subtitle')}</Text>
        <OntimeRaceLeaders />
      </ScrollView>
    </View>
  )
}
