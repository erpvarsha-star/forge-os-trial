import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { STATUS } from '@/components/theme'
import { CheckCircle2 } from 'lucide-react-native'
import { useHalfDayCoffConflicts, HalfDayConflictRow } from '@/hooks/useHalfDayCoffConflicts'
import type { HalfDayDecision } from '@/hooks/useHalfDayCoff'

type Pending = HalfDayDecision | 'escalate'

function ConflictCard({
  row, canEscalate, onSettle, onEscalate,
}: {
  row: HalfDayConflictRow
  canEscalate: boolean
  onSettle: (id: string, d: HalfDayDecision, note: string) => Promise<boolean>
  onEscalate: (id: string, note: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const label = (o: HalfDayDecision) => (o === 'deduct_full_day' ? t('halfDayCoff.deductFull') : t('halfDayCoff.noDeduction'))

  const confirm = async () => {
    if (!pending || busy) return
    if (pending !== 'escalate' && !note.trim()) return
    setBusy(true)
    if (pending === 'escalate') await onEscalate(row.request_id, note.trim())
    else await onSettle(row.request_id, pending, note.trim())
    setBusy(false)
  }

  return (
    <Card className="mb-3">
      <Text className="text-sm font-bold text-ink-900">
        {row.name} <Text className="font-mono text-xs text-ink-500">({row.emp_code})</Text>
      </Text>
      <Text className="text-xs text-ink-500">{row.department ?? '—'}</Text>
      <Text className="text-sm text-ink-700 mt-2">{row.leave_date} · {t('halfDayCoff.usesHalfDay')}</Text>
      {row.reason ? <Text className="text-sm text-ink-600 mt-1">{row.reason}</Text> : null}
      <View className="mt-2">
        <Text className="text-sm text-ink-900"><Text className="font-semibold">{t('halfDayConflicts.hr')}: </Text>{label(row.hr_outcome)}</Text>
        <Text className="text-xs text-ink-600">{row.hr_note}</Text>
        <Text className="text-sm text-ink-900 mt-1"><Text className="font-semibold">{t('halfDayConflicts.kajal')}: </Text>{label(row.kajal_outcome)}</Text>
        <Text className="text-xs text-ink-600">{row.kajal_note}</Text>
      </View>
      {row.stage === 'owner' ? (
        <Text className="text-xs text-status-pending mt-2">
          {t('halfDayConflicts.escalated')}{row.escalation_note ? `: ${row.escalation_note}` : ''}
        </Text>
      ) : null}
      <Text className="text-sm font-semibold text-brand-600 mt-2">{t('halfDayCoff.unusedDays', { count: row.unused_ledger_days })}</Text>

      {pending === null ? (
        <View className="mt-3 gap-2">
          <Button title="halfDayCoff.deductFull" onPress={() => { setPending('deduct_full_day'); setNote('') }} size="md" />
          <Button title="halfDayCoff.noDeduction" onPress={() => { setPending('no_deduction'); setNote('') }} variant="outline" size="md" />
          {canEscalate ? (
            <Button title="halfDayConflicts.escalate" onPress={() => { setPending('escalate'); setNote('') }} variant="secondary" size="md" />
          ) : null}
        </View>
      ) : (
        <View className="mt-3">
          <Text className="text-sm font-semibold text-ink-900 mb-2">
            {pending === 'escalate' ? t('halfDayConflicts.escalate') : label(pending)}
          </Text>
          <Input
            value={note}
            onChangeText={setNote}
            label={pending === 'escalate' ? t('halfDayConflicts.escalateNote') : t('halfDayCoff.note')}
            placeholder={t('halfDayCoff.notePlaceholder')}
            multiline
            numberOfLines={3}
            required={pending !== 'escalate'}
          />
          <View className="flex-row gap-2 mt-3">
            <Button title="common.cancel" onPress={() => setPending(null)} variant="secondary" size="md" className="flex-1" disabled={busy} />
            <Button title="halfDayCoff.confirm" onPress={confirm} size="md" className="flex-1" loading={busy} disabled={pending !== 'escalate' && !note.trim()} />
          </View>
        </View>
      )}
    </Card>
  )
}

export function HalfDayCoffConflicts() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { rows, isLoading, isRefreshing, loadError, refresh, settle, escalate } = useHalfDayCoffConflicts()
  const canEscalate = employee?.role === 'plant_head'

  const onSettle = async (id: string, d: HalfDayDecision, note: string) => {
    const err = await settle(id, d, note)
    if (err) { Alert.alert(t('common.error'), err); return false }
    Alert.alert(t('common.success'), t('halfDayCoff.decided'))
    return true
  }
  const onEscalate = async (id: string, note: string) => {
    const err = await escalate(id, note)
    if (err) { Alert.alert(t('common.error'), err); return false }
    Alert.alert(t('common.success'), t('halfDayConflicts.escalatedDone'))
    return true
  }

  if (!employee || isLoading) return <LoadingScreen />

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-ink-50">
        <Header empCode={employee.emp_code} role={employee.role} />
        <ScrollView
          className="flex-1 p-4"
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('halfDayConflicts.title')}</Text>
            {rows.length > 0 && (
              <View className="bg-status-pending-bg px-3 py-1 rounded-full">
                <Text className="text-sm font-bold text-status-pending">{rows.length}</Text>
              </View>
            )}
          </View>
          {loadError ? <Card className="mb-4"><Text className="text-sm text-status-rejected">{loadError}</Text></Card> : null}
          {rows.length === 0 && !loadError ? (
            <Card className="items-center py-10">
              <CheckCircle2 size={32} color={STATUS.approved.fg} />
              <Text className="text-sm text-ink-500 mt-3 text-center">{t('halfDayConflicts.empty')}</Text>
            </Card>
          ) : (
            rows.map(row => (
              <ConflictCard key={row.request_id} row={row} canEscalate={canEscalate} onSettle={onSettle} onEscalate={onEscalate} />
            ))
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}
