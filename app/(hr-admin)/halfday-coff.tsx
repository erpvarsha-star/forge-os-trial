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
import { useHalfDayCoff, HalfDayCoffRow, HalfDayDecision } from '@/hooks/useHalfDayCoff'

function CoffCard({
  row, onDecide,
}: {
  row: HalfDayCoffRow
  onDecide: (id: string, decision: HalfDayDecision, note: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<HalfDayDecision | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!pending || !note.trim() || busy) return
    setBusy(true)
    const ok = await onDecide(row.request_id, pending, note.trim())
    setBusy(false)
    if (!ok) return // card stays open so the note is not lost
  }

  return (
    <Card className="mb-3">
      <Text className="text-sm font-bold text-ink-900">
        {row.name}{' '}
        <Text className="font-mono text-xs text-ink-500">({row.emp_code})</Text>
      </Text>
      <Text className="text-xs text-ink-500">{row.department ?? '—'}</Text>
      <Text className="text-sm text-ink-700 mt-2">{row.leave_date} · {t('halfDayCoff.usesHalfDay')}</Text>
      {row.reason ? <Text className="text-sm text-ink-600 mt-1">{row.reason}</Text> : null}
      {row.is_conflict ? (
        <Text className="text-sm font-semibold text-status-rejected mt-2">
          {t('halfDayCoff.conflict', { hr: row.hr_outcome === 'deduct_full_day' ? t('halfDayCoff.deductFull') : t('halfDayCoff.noDeduction'), kajal: row.kajal_outcome === 'deduct_full_day' ? t('halfDayCoff.deductFull') : t('halfDayCoff.noDeduction') })}
        </Text>
      ) : row.hr_decided || row.kajal_decided ? (
        <Text className="text-xs text-ink-500 mt-2">
          {row.hr_decided ? t('halfDayCoff.hrDone') : t('halfDayCoff.kajalDone')}
        </Text>
      ) : null}
      <Text className="text-sm font-semibold text-brand-600 mt-2">
        {t('halfDayCoff.unusedDays', { count: row.unused_ledger_days })}
      </Text>

      {pending === null ? (
        <View className="mt-3 gap-2">
          <Button title="halfDayCoff.deductFull" onPress={() => { setPending('deduct_full_day'); setNote('') }} size="md" />
          <Button title="halfDayCoff.noDeduction" onPress={() => { setPending('no_deduction'); setNote('') }} variant="outline" size="md" />
        </View>
      ) : (
        <View className="mt-3">
          <Text className="text-sm font-semibold text-ink-900 mb-2">
            {pending === 'deduct_full_day' ? t('halfDayCoff.deductFull') : t('halfDayCoff.noDeduction')}
          </Text>
          <Input
            value={note}
            onChangeText={setNote}
            label={t('halfDayCoff.note')}
            placeholder={t('halfDayCoff.notePlaceholder')}
            multiline
            numberOfLines={3}
            required
          />
          <View className="flex-row gap-2 mt-3">
            <Button title="common.cancel" onPress={() => setPending(null)} variant="secondary" size="md" className="flex-1" disabled={busy} />
            <Button title="halfDayCoff.confirm" onPress={confirm} size="md" className="flex-1" loading={busy} disabled={!note.trim()} />
          </View>
        </View>
      )}
    </Card>
  )
}

export default function HalfDayCoffScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { rows, isLoading, isRefreshing, loadError, refresh, decide } = useHalfDayCoff()

  const handleDecide = async (id: string, decision: HalfDayDecision, note: string) => {
    const err = await decide(id, decision, note)
    if (err) {
      Alert.alert(t('common.error'), err)
      return false
    }
    Alert.alert(t('common.success'), t('halfDayCoff.decided'))
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
            <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('halfDayCoff.title')}</Text>
            {rows.length > 0 && (
              <View className="bg-status-pending-bg px-3 py-1 rounded-full">
                <Text className="text-sm font-bold text-status-pending">{rows.length}</Text>
              </View>
            )}
          </View>

          {loadError ? (
            <Card className="mb-4"><Text className="text-sm text-status-rejected">{loadError}</Text></Card>
          ) : null}

          {rows.length === 0 && !loadError ? (
            <Card className="items-center py-10">
              <CheckCircle2 size={32} color={STATUS.approved.fg} />
              <Text className="text-sm text-ink-500 mt-3 text-center">{t('halfDayCoff.empty')}</Text>
            </Card>
          ) : (
            rows.map(row => <CoffCard key={row.request_id} row={row} onDecide={handleDecide} />)
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}
