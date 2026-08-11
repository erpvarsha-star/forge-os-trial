import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { EODConfirmation } from '@/types'
import { ShieldCheck, ShieldAlert } from 'lucide-react-native'

export default function EODLockScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [inwardCount, setInwardCount] = useState(0)
  const [outwardCount, setOutwardCount] = useState(0)
  const [existing, setExisting] = useState<EODConfirmation | null>(null)
  const [mismatchReason, setMismatchReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const mismatch = inwardCount !== outwardCount

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    const [vehicleRes, eodRes] = await Promise.all([
      supabase.from('vehicle_log').select('direction').gte('created_at', `${today}T00:00:00`),
      supabase.from('eod_confirmations').select('*').eq('date', today).maybeSingle(),
    ])
    const entries = (vehicleRes.data ?? []) as { direction: 'inward' | 'outward' }[]
    setInwardCount(entries.filter(e => e.direction === 'inward').length)
    setOutwardCount(entries.filter(e => e.direction === 'outward').length)
    if (eodRes.data) setExisting(eodRes.data as EODConfirmation)
    setIsLoading(false)
  }, [today])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const confirmEod = async () => {
    if (mismatch && !mismatchReason.trim()) {
      Alert.alert(t('common.error'), t('security.mismatchReasonRequired'))
      return
    }
    setIsConfirming(true)
    const { error } = await supabase.from('eod_confirmations').upsert(
      {
        security_guard_id: employee.id,
        date: today,
        inward_count: inwardCount,
        outward_count: outwardCount,
        mismatch_reason: mismatch ? mismatchReason.trim() : null,
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: 'security_guard_id,date' }
    )
    setIsConfirming(false)
    if (!error) { Alert.alert(t('common.success'), t('security.eodConfirmed')); fetchStatus() }
    else Alert.alert(t('common.error'), t('common.somethingWentWrong'))
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-sm font-bold text-ink-700 mb-2 px-1">{t('common.today')}</Text>
        <Card className="mb-4">
          <Text className="text-xs text-ink-500 mb-3 -mt-1">{t('security.eodHint')}</Text>
          <View className="flex-row">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-green-600">{inwardCount}</Text>
              <Text className="text-xs text-ink-500 mt-0.5">{t('security.inward')}</Text>
            </View>
            <View className="w-px bg-ink-100" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-blue-600">{outwardCount}</Text>
              <Text className="text-xs text-ink-500 mt-0.5">{t('security.outward')}</Text>
            </View>
          </View>
        </Card>

        <Card className={mismatch ? 'border-red-300 mb-4' : 'border-green-300 mb-4'}>
          <View className="flex-row items-center gap-2 mb-2">
            {mismatch ? <ShieldAlert size={20} color="#DC2626" /> : <ShieldCheck size={20} color="#16A34A" />}
            <Text className={`text-sm font-semibold ${mismatch ? 'text-red-600' : 'text-green-600'}`}>
              {mismatch ? t('security.countMismatch') : t('security.countsMatch')}
            </Text>
          </View>
          {mismatch && (
            <Input
              label={t('common.reason')}
              value={mismatchReason}
              onChangeText={setMismatchReason}
              placeholder={t('security.mismatchReasonPlaceholder')}
              multiline
              numberOfLines={3}
            />
          )}
        </Card>

        {existing && (
          <Card className="mb-4">
            <Text className="text-sm text-ink-600">
              {t('security.alreadyConfirmedAt')} {new Date(existing.confirmed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {existing.mismatch_reason && (
              <Text className="text-xs text-ink-500 mt-1">{t('common.reason')}: {existing.mismatch_reason}</Text>
            )}
          </Card>
        )}

        <Button
          title={existing ? 'security.reconfirmEod' : 'security.confirmEod'}
          onPress={confirmEod}
          loading={isConfirming}
          variant={mismatch ? 'danger' : 'primary'}
        />
      </ScrollView>
    </View>
  )
}
