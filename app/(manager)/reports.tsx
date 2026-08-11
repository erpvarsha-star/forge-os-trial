import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { FileText, Clock } from 'lucide-react-native'
import { INK } from '@/components/theme'

export default function ManagerReports() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />

  // Report generation is not yet wired to live data (known gap) — shown as
  // a clearly-labelled coming-soon list rather than fake actionable rows.
  const plannedReports = [
    t('manager.reportTypeAttendance'),
    t('manager.reportTypeProduction'),
    t('manager.reportTypeScore'),
  ]

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.reports')}</Text>
        </View>

        <Card className="mb-4 items-center py-6">
          <Clock size={28} color={INK[300]} />
          <Text className="text-sm font-semibold text-ink-700 mt-3">{t('manager.reportsComingSoonTitle')}</Text>
          <Text className="text-xs text-ink-400 mt-1 text-center px-4">{t('manager.reportsComingSoonBody')}</Text>
        </Card>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('manager.plannedReports')}</Text>
        {plannedReports.map(label => (
          <Card key={label} className="mb-2" variant="flat">
            <View className="flex-row items-center gap-3 opacity-60">
              <FileText size={18} color={INK[400]} />
              <Text className="text-sm text-ink-500 flex-1">{label}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
