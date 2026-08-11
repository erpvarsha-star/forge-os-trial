import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { Clock, User, UserCheck } from 'lucide-react-native'
import { BRAND, STATUS, INK } from '@/components/theme'

export default function NewEmployeeFlowScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [pending, setPending] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { data } = await supabase.from('employees').select('*').eq('is_active', false).order('created_at', { ascending: false })
      if (data) setPending(data as Employee[])
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.newEmployeeFlow')}</Text>
          {pending.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: pending.length })}</Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-ink-500 mb-4">{t('hrAdmin.activationSteps')}</Text>

        <Card className="mb-6">
          <View className="flex-row justify-between px-1">
            {['step1', 'step2', 'step3', 'step4'].map((step, i) => (
              <View key={step} className="items-center flex-1">
                <View className={`w-8 h-8 rounded-full items-center justify-center mb-1.5 ${i === 0 ? 'bg-brand-600' : 'bg-ink-100'}`}>
                  <Text className={`text-xs font-bold ${i === 0 ? 'text-white' : 'text-ink-500'}`}>{i + 1}</Text>
                </View>
                <Text className="text-2xs text-ink-500 text-center leading-4">{t(`hrAdmin.${step}`)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('hrAdmin.pendingActivations')}</Text>
        {pending.length === 0 ? (
          <Card className="items-center py-10">
            <UserCheck size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noPendingActivations')}</Text>
          </Card>
        ) : (
          pending.map(emp => (
            <Card key={emp.id} className="mb-3">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center"><User size={18} color={BRAND[600]} /></View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink-900">{emp.name}</Text>
                  <Text className="text-xs text-ink-500 font-mono mt-0.5">{emp.emp_code} • {emp.phone || '—'}</Text>
                </View>
                <View className="w-8 h-8 rounded-full bg-status-pending-bg items-center justify-center">
                  <Clock size={15} color={STATUS.pending.fg} />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
