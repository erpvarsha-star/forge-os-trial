import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useNeedsYourCall } from '@/hooks/useNeedsYourCall'
import { NeedsYourCallReview } from '@/components/NeedsYourCallReview'

// Owner-only review for employee_shifts rows the system guessed on
// (inferred or reclassified) rather than HR allocating. Fraud alert
// resolution is the other half of "Needs Your Call" and already lives in
// app/(owner)/alerts.tsx — kept as its own screen since it was shipped
// first and reuses alerts.tsx's existing severity/type presentation.
export default function NeedsYourCallScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { items, shifts, isLoading, actingId, resolve } = useNeedsYourCall()

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">{t('needsYourCall.title')}</Text>
        <Text className="text-sm text-ink-500 mb-5">{t('needsYourCall.subtitle')}</Text>
        <NeedsYourCallReview items={items} shifts={shifts} isLoading={isLoading} actingId={actingId} onResolve={resolve} />
      </ScrollView>
    </View>
  )
}
