import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { AdvanceRequest } from '@/types'
import { Wallet } from 'lucide-react-native'

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
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('hrAdmin.advanceLedger')}</Text>
        {advances.map(adv => (
          <Card key={adv.id} className="mb-2">
            <View className="flex-row items-center gap-3">
              <Wallet size={18} className="text-orange-600" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{adv.employee?.name}</Text>
                <Text className="text-xs text-gray-500">₹{adv.amount} • {adv.repayment_months} months</Text>
                <Text className="text-xs text-gray-500">Outstanding: ₹{adv.outstanding_balance}</Text>
              </View>
              <Text className={`text-xs font-bold capitalize ${adv.status === 'approved' ? 'text-green-600' : adv.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{adv.status}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
