import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { AlertCircle, User } from 'lucide-react-native'

export default function MissingDataScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [incomplete, setIncomplete] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { data } = await supabase.from('employees').select('*').eq('is_active', true)
      if (data) {
        const filtered = (data as Employee[]).filter(e => !e.department || !e.category || !e.supervisor_id)
        setIncomplete(filtered)
      }
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('hrAdmin.missingData')}</Text>
        {incomplete.map(emp => (
          <Card key={emp.id} className="mb-2 bg-yellow-50 border-yellow-200">
            <View className="flex-row items-center gap-3">
              <AlertCircle size={18} className="text-yellow-600" />
              <View>
                <Text className="text-sm font-bold text-gray-900">{emp.name} ({emp.emp_code})</Text>
                <Text className="text-xs text-yellow-700">
                  Missing: {!emp.department ? 'Department ' : ''}{!emp.category ? 'Category ' : ''}{!emp.supervisor_id ? 'Supervisor' : ''}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
