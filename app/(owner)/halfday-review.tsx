import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { STATUS } from '@/components/theme'
import { CheckCircle2 } from 'lucide-react-native'
import { useDecidedHalfDayCoff, DecidedHalfDayCoffRow } from '@/hooks/useDecidedHalfDayCoff'
import { formatIst } from '@/hooks/useOnboarding'

function ReviewCard({
  row, onReview,
}: {
  row: DecidedHalfDayCoffRow
  onReview: (id: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const reviewed = !!row.owner_reviewed_at

  const press = async () => {
    if (busy) return
    setBusy(true)
    await onReview(row.request_id)
    setBusy(false)
  }

  return (
    <Card className={`mb-3 ${reviewed ? 'opacity-60' : ''}`}>
      <Text className="text-sm font-bold text-ink-900">
        {row.name}{' '}
        <Text className="font-mono text-xs text-ink-500">({row.emp_code})</Text>
      </Text>
      <Text className="text-xs text-ink-500">{row.department ?? '—'}</Text>
      <Text className="text-sm text-ink-700 mt-2">{row.leave_date} · {t('halfDayReview.halfDay')}</Text>
      <Text className="text-sm font-semibold text-brand-600 mt-2">
        {t('halfDayReview.decision')}: {row.decision}
      </Text>
      {row.decision_note ? (
        <Text className="text-sm text-ink-600 mt-1">{t('halfDayReview.note')}: {row.decision_note}</Text>
      ) : null}
      <Text className="text-xs text-ink-500 mt-2">
        {t('halfDayReview.decidedBy', { name: row.decided_by_name ?? '—', when: formatIst(row.decided_at) })}
      </Text>
      {reviewed ? (
        <Text className="text-xs font-semibold text-status-approved mt-2">
          {t('halfDayReview.reviewed')} · {formatIst(row.owner_reviewed_at)}
        </Text>
      ) : (
        <Button title="halfDayReview.markReviewed" onPress={press} size="md" className="mt-3" loading={busy} />
      )}
    </Card>
  )
}

export default function HalfDayReviewScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { rows, isLoading, isRefreshing, loadError, refresh, markReviewed } = useDecidedHalfDayCoff()

  const handleReview = async (id: string) => {
    const err = await markReviewed(id)
    if (err) Alert.alert(t('common.error'), err)
  }

  if (!employee || isLoading) return <LoadingScreen />

  const unreviewed = rows.filter(r => !r.owner_reviewed_at)
  const reviewed = rows.filter(r => !!r.owner_reviewed_at)

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('halfDayReview.title')}</Text>
          {unreviewed.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{unreviewed.length}</Text>
            </View>
          )}
        </View>

        {loadError ? (
          <Card className="mb-4"><Text className="text-sm text-status-rejected">{loadError}</Text></Card>
        ) : null}

        {rows.length === 0 && !loadError ? (
          <Card className="items-center py-10">
            <CheckCircle2 size={32} color={STATUS.approved.fg} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('halfDayReview.empty')}</Text>
          </Card>
        ) : (
          [...unreviewed, ...reviewed].map(row => (
            <ReviewCard key={row.request_id} row={row} onReview={handleReview} />
          ))
        )}
      </ScrollView>
    </View>
  )
}
