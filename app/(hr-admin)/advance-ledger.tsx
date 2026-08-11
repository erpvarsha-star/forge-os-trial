import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { AdvanceRequest } from '@/types'
import { Wallet, ReceiptText } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

export default function AdvanceLedgerScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [advances, setAdvances] = useState<AdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { data } = await supabase.from('advance_requests').select('*, employee:employees(name, emp_code)').order('created_at', { ascending: false })
      if (data) setAdvances(data as AdvanceRequest[])
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const statusBadge = (status: AdvanceRequest['status']) => {
    switch (status) {
      case 'approved': return { bg: 'bg-status-approved-bg', text: 'text-status-approved' }
      case 'rejected': return { bg: 'bg-status-rejected-bg', text: 'text-status-rejected' }
      default: return { bg: 'bg-status-pending-bg', text: 'text-status-pending' }
    }
  }

  const totalOutstanding = advances.filter(a => a.status === 'approved').reduce((sum, a) => sum + (a.outstanding_balance || 0), 0)
  const pendingCount = advances.filter(a => a.status === 'pending').length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.advanceLedger')}</Text>
        </View>

        {advances.length > 0 && (
          <View className="flex-row gap-3 mb-6">
            <Card className="flex-1 items-center py-4">
              <Text className="text-2xl font-bold text-brand-600 font-mono tabular-nums">₹{totalOutstanding.toLocaleString()}</Text>
              <Text className="text-xs text-ink-500 mt-1 text-center">{t('hrAdmin.totalOutstanding')}</Text>
            </Card>
            <Card className="flex-1 items-center py-4">
              <Text className="text-2xl font-bold text-status-pending tabular-nums">{pendingCount}</Text>
              <Text className="text-xs text-ink-500 mt-1 text-center">{t('common.pending')}</Text>
            </Card>
          </View>
        )}

        {advances.length === 0 ? (
          <Card className="items-center py-10">
            <ReceiptText size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noAdvancesYet')}</Text>
          </Card>
        ) : (
          advances.map(adv => {
            const badge = statusBadge(adv.status)
            return (
              <Card key={adv.id} className="mb-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center"><Wallet size={16} color={BRAND[600]} /></View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink-900">{adv.employee?.name}</Text>
                    <Text className="text-xs text-ink-500 font-mono mt-0.5">₹{adv.amount.toLocaleString()} • {adv.repayment_months}mo</Text>
                    <Text className="text-xs text-ink-500 mt-0.5">{t('hrAdmin.outstanding')}: <Text className="font-mono">₹{adv.outstanding_balance.toLocaleString()}</Text></Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                    <Text className={`text-xs font-bold capitalize ${badge.text}`}>{t(`common.${adv.status}`)}</Text>
                  </View>
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
