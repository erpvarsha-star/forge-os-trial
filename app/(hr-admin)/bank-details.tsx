import React, { useState } from 'react'
import {
  View, Text, ScrollView, Alert, RefreshControl, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { STATUS } from '@/components/theme'
import { CheckCircle2 } from 'lucide-react-native'
import { useBankDetails, MissingBankRow } from '@/hooks/useBankDetails'

type FieldKey = 'bank_name' | 'account_no' | 'ifsc' | 'uan' | 'pan'
const FIELDS: FieldKey[] = ['bank_name', 'account_no', 'ifsc', 'uan', 'pan']

const FIELD_LABEL: Record<FieldKey, string> = {
  bank_name: 'bankDetails.bankName',
  account_no: 'bankDetails.accountNo',
  ifsc: 'bankDetails.ifsc',
  uan: 'bankDetails.uan',
  pan: 'bankDetails.pan',
}

// Never show a full stored value: last 4 characters only.
const maskValue = (v: string) => (v.length <= 4 ? '••••' : `${'•'.repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}`)

const isMissing = (row: MissingBankRow, key: FieldKey) =>
  (row.missing ?? []).some(m => m.toLowerCase().replace(/[^a-z]/g, '') === key.replace(/_/g, ''))

function BankRowCard({
  row, onSave,
}: {
  row: MissingBankRow
  onSave: (structureId: string, values: Record<FieldKey, string>) => Promise<void>
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<FieldKey, string>>({
    bank_name: '', account_no: '', ifsc: '', uan: '', pan: '',
  })
  const [saving, setSaving] = useState(false)

  const missingKeys = FIELDS.filter(k => isMissing(row, k))
  const filledKeys = FIELDS.filter(k => !isMissing(row, k) && (row[k] ?? '') !== '')
  const hasInput = missingKeys.some(k => values[k].trim() !== '')

  const submit = async () => {
    setSaving(true)
    try { await onSave(row.structure_id, values) } finally { setSaving(false) }
  }

  const keyboardFor = (k: FieldKey) => (k === 'account_no' || k === 'uan' ? 'numeric' : 'default')

  return (
    <Card className="mb-3">
      <Text className="text-sm font-bold text-ink-900">
        {row.name}{' '}
        <Text className="font-mono text-xs text-ink-500">({row.emp_code})</Text>
      </Text>
      <Text className="text-xs text-ink-500 mb-3">{row.department ?? '—'}</Text>

      {filledKeys.map(k => (
        <View key={k} className="mb-2">
          <Text className="text-xs font-semibold text-ink-500">{t(FIELD_LABEL[k])}</Text>
          <Text className="text-sm font-mono text-ink-700">{maskValue(String(row[k]))}</Text>
        </View>
      ))}

      {missingKeys.map(k => (
        <View key={k} className="mb-3">
          <Text className="text-sm font-semibold text-ink-700 mb-1.5">{t(FIELD_LABEL[k])}</Text>
          <TextInput
            value={values[k]}
            onChangeText={txt => setValues(v => ({ ...v, [k]: txt }))}
            keyboardType={keyboardFor(k)}
            autoCapitalize={k === 'ifsc' || k === 'pan' ? 'characters' : k === 'bank_name' ? 'words' : 'none'}
            autoCorrect={false}
            className="border-[1.5px] border-ink-300 rounded-lg px-4 py-3 text-base text-ink-900 bg-white min-h-touch"
            placeholderTextColor="#8B93A3"
          />
        </View>
      ))}

      <Button
        title="bankDetails.save"
        onPress={submit}
        loading={saving}
        disabled={!hasInput}
        size="md"
      />
    </Card>
  )
}

export default function BankDetailsScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { rows, isLoading, isRefreshing, loadError, refresh, save } = useBankDetails()

  const handleSave = async (structureId: string, values: Record<FieldKey, string>) => {
    // Blank boxes go to the server as null, never as empty strings.
    const clean = (s: string) => (s.trim() === '' ? null : s.trim())
    const err = await save(structureId, {
      bank_name: clean(values.bank_name),
      account_no: clean(values.account_no),
      ifsc: clean(values.ifsc),
      uan: clean(values.uan),
      pan: clean(values.pan),
    })
    if (err) Alert.alert(t('common.error'), err)
    else Alert.alert(t('common.success'), t('bankDetails.saved'))
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
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('bankDetails.title')}</Text>
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
              <Text className="text-sm text-ink-500 mt-3 text-center">{t('bankDetails.allComplete')}</Text>
            </Card>
          ) : (
            <>
              <Text className="text-xs text-ink-500 mb-4">{t('bankDetails.needDetails', { count: rows.length })}</Text>
              {rows.map(row => (
                <BankRowCard key={row.structure_id} row={row} onSave={handleSave} />
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}
