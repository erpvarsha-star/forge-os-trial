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
import { INK } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={supervisors}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.team')}</Text>
            {supervisors.length > 0 && (
              <View className="bg-ink-100 px-3 py-1 rounded-full">
                <Text className="text-sm font-bold text-ink-600">{supervisors.length} {t('manager.supervisorCount')}</Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Card className="mb-3">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center"><User size={18} color={INK[500]} /></View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{item.name}</Text>
                <Text className="text-xs text-ink-500 font-mono">{item.emp_code} • {item.department}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <Card className="items-center py-10">
            <Users size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('manager.noSupervisors')}</Text>
          </Card>
        }
      />
    </View>
  )
}
