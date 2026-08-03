import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { CheckCircle, Clock, User } from 'lucide-react-native'

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
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('hrAdmin.newEmployeeFlow')}</Text>
        <Text className="text-sm text-gray-500 mb-4">{t('hrAdmin.activationSteps')}</Text>
        <View className="flex-row justify-between mb-4 px-2">
          {['step1', 'step2', 'step3', 'step4'].map((step, i) => (
            <View key={step} className="items-center flex-1">
              <View className={`w-8 h-8 rounded-full items-center justify-center mb-1 ${i === 0 ? 'bg-orange-600' : 'bg-gray-200'}`}>
                <Text className={`text-xs font-bold ${i === 0 ? 'text-white' : 'text-gray-500'}`}>{i + 1}</Text>
              </View>
              <Text className="text-xs text-gray-500 text-center">{t(`hrAdmin.${step}`)}</Text>
            </View>
          ))}
        </View>
        {pending.map(emp => (
          <Card key={emp.id} className="mb-2">
            <View className="flex-row items-center gap-3">
              <User size={18} className="text-orange-600" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{emp.name}</Text>
                <Text className="text-xs text-gray-500">{emp.emp_code} • {emp.phone}</Text>
              </View>
              <Clock size={16} className="text-yellow-600" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
