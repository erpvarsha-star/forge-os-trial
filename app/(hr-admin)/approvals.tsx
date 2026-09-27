import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLeaveAdvanceApprovals } from '@/hooks/useLeaveAdvanceApprovals'
import { LeaveAdvanceApprovalCards } from '@/components/LeaveAdvanceApprovalCards'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Inbox } from 'lucide-react-native'
import { INK } from '@/components/theme'

// New screen — HR (Pallavi) is a stage in nearly every leave/advance chain
// under the frozen design (CLAUDE.md: "Leave & Advance approval chains"),
// but had no approvals screen at all under the old flat model.
export default function HRAdminApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { leaves, advances, isLoading, actingId, reviewLeave, reviewAdvance } = useLeaveAdvanceApprovals()

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const totalPending = leaves.length + advances.length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.approvals')}</Text>
          {totalPending > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: totalPending })}</Text>
            </View>
          )}
        </View>

        {totalPending === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('common.allClear')}</Text>
          </Card>
        ) : (
          <LeaveAdvanceApprovalCards
            leaves={leaves}
            advances={advances}
            actingId={actingId}
            onReviewLeave={reviewLeave}
            onReviewAdvance={reviewAdvance}
          />
        )}
      </ScrollView>
    </View>
  )
}
