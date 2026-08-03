import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { MonthlyScore } from '@/types'
import { Award, Medal, Star, Trophy } from 'lucide-react-native'

export default function EOTMScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [winners, setWinners] = useState<Record<string, MonthlyScore & { employee: any }>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const now = new Date()
      const categories = ['attendance', 'production', 'safety', '5s']
      const results: any = {}
      for (const cat of categories) {
        const { data } = await supabase.from('monthly_scores').select('*, employee:employees(name, emp_code, department)').eq('month', String(now.getMonth()).padStart(2, '0')).eq('year', now.getFullYear()).order(`${cat}_score`, { ascending: false }).limit(1).single()
        if (data) results[cat] = data
      }
      setWinners(results)
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />

  const categories = [
    { key: 'attendance', icon: <Star size={24} className="text-yellow-500" />, label: 'owner.eotmAttendance' },
    { key: 'production', icon: <Trophy size={24} className="text-orange-600" />, label: 'owner.eotmProduction' },
    { key: 'safety', icon: <Medal size={24} className="text-blue-600" />, label: 'owner.eotmSafety' },
    { key: '5s', icon: <Award size={24} className="text-green-600" />, label: 'owner.eotm5s' },
  ]

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('owner.eotm')}</Text>
        {categories.map(cat => (
          <Card key={cat.key} className="mb-3">
            <View className="flex-row items-center gap-3 mb-2">{cat.icon}<Text className="text-base font-bold text-gray-900">{t(cat.label)}</Text></View>
            {winners[cat.key] ? (
              <View>
                <Text className="text-lg font-bold text-orange-600">{winners[cat.key].employee?.name}</Text>
                <Text className="text-xs text-gray-500">{winners[cat.key].employee?.emp_code} • {winners[cat.key].employee?.department}</Text>
              </View>
            ) : (
              <Text className="text-sm text-gray-500">{t('common.noData')}</Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
