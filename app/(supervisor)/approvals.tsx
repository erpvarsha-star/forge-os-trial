import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Inbox } from 'lucide-react-native'
import { INK } from '@/components/theme'

// Supervisors are not in either the leave or the advance approval chain —
// frozen 27 Sep 2026 (CLAUDE.md: "Leave & Advance approval chains"). Both
// chains now start at the requester's Manager, skipping the supervisor
// stage entirely, per Yash's exact instruction ("we can remove the
// supervisor approval"). This screen is kept (rather than removed) only so
// the existing tab route doesn't 404 for anyone still on an older build.
export default function SupervisorApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.approvals')}</Text>
        </View>
        <Card className="items-center py-10">
          <Inbox size={32} color={INK[300]} />
          <Text className="text-sm text-ink-500 mt-3 text-center">{t('supervisor.approvalsMoved')}</Text>
        </Card>
      </ScrollView>
    </View>
  )
}
