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
import { Save, Users } from 'lucide-react-native'
import { BRAND } from '@/components/theme'

export default function CasualWorkersScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [unskilledCount, setUnskilledCount] = useState('0')
  const [skilledCount, setSkilledCount] = useState('0')
  const [operatorCount, setOperatorCount] = useState('0')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const fetchToday = useCallback(async () => {
    if (!employee) return
    setIsLoading(true)
    const { data } = await supabase
      .from('casual_workers')
      .select('*')
      .eq('supervisor_id', employee.id)
      .eq('date', today)
      .maybeSingle()
    if (data) {
      setUnskilledCount(String(data.unskilled_count ?? 0))
      setSkilledCount(String(data.skilled_count ?? 0))
      setOperatorCount(String(data.operator_count ?? 0))
    }
    setIsLoading(false)
  }, [employee, today])

  useEffect(() => { fetchToday() }, [fetchToday])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const total = (parseInt(unskilledCount, 10) || 0) + (parseInt(skilledCount, 10) || 0) + (parseInt(operatorCount, 10) || 0)

  const handleSave = async () => {
    setIsSubmitting(true)
    const { error } = await supabase.from('casual_workers').upsert(
      {
        supervisor_id: employee.id,
        date: today,
        unskilled_count: parseInt(unskilledCount, 10) || 0,
        skilled_count: parseInt(skilledCount, 10) || 0,
        operator_count: parseInt(operatorCount, 10) || 0,
      },
      { onConflict: 'supervisor_id,date' }
    )
    setIsSubmitting(false)
    if (!error) Alert.alert(t('common.success'), t('supervisor.casualWorkerSaved'))
    else Alert.alert(t('common.error'), t('common.somethingWentWrong'))
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('supervisor.casualWorkerLog')}</Text>
        </View>

        <Card className="mb-4 items-center py-5">
          <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center mb-2"><Users size={20} color={BRAND[600]} /></View>
          <Text className="text-3xl font-bold text-brand-600 tabular-nums">{total}</Text>
          <Text className="text-xs text-ink-500 mt-1">{t('supervisor.casualWorkersToday')}</Text>
        </Card>

        <Card title={t('supervisor.addCasualWorker')}>
          <View className="gap-3">
            <Input
              label={t('supervisor.unskilledCount')}
              value={unskilledCount}
              onChangeText={v => setUnskilledCount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <Input
              label={t('supervisor.skilledCount')}
              value={skilledCount}
              onChangeText={v => setSkilledCount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <Input
              label={t('supervisor.operatorCount')}
              value={operatorCount}
              onChangeText={v => setOperatorCount(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
            <Button title={t('common.save')} onPress={handleSave} loading={isSubmitting} icon={<Save size={18} color="white" />} className="mt-1" />
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}
