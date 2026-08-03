import React, { useState, useEffect } from 'react'
import { View, Text, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { Users, User } from 'lucide-react-native'

export default function ManagerTeam() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [supervisors, setSupervisors] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchTeam() }, [employee])

  const fetchTeam = async () => {
    if (!employee) return
    const { data } = await supabase.from('employees').select('*').eq('manager_id', employee.id)
    if (data) setSupervisors(data as Employee[])
    setIsLoading(false)
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={supervisors}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><User size={18} color="#6B7280" /></View>
              <View>
                <Text className="text-sm font-bold text-gray-900">{item.name}</Text>
                <Text className="text-xs text-gray-500">{item.emp_code} • {item.department}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text className="text-center text-gray-500 py-8">{t('common.noData')}</Text>}
      />
    </View>
  )
}
