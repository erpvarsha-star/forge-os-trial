import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Employee } from '@/types'
import { AlertCircle, CheckCircle2 } from 'lucide-react-native'
import { STATUS } from '@/components/theme'

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
  if (isLoading) return <LoadingScreen />

  const missingFieldLabels = (emp: Employee) => {
    const fields: string[] = []
    if (!emp.department) fields.push(t('common.department'))
    if (!emp.category) fields.push(t('common.category'))
    if (!emp.supervisor_id) fields.push(t('hrAdmin.supervisorField'))
    return fields
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('hrAdmin.missingData')}</Text>
          {incomplete.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{incomplete.length}</Text>
            </View>
          )}
        </View>

        {incomplete.length === 0 ? (
          <Card className="items-center py-10">
            <CheckCircle2 size={32} color={STATUS.approved.fg} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('hrAdmin.noMissingData')}</Text>
          </Card>
        ) : (
          incomplete.map(emp => (
            <Card key={emp.id} className="mb-3 bg-status-pending-bg" variant="flat">
              <View className="flex-row items-start gap-3">
                <AlertCircle size={18} color={STATUS.pending.fg} style={{ marginTop: 1 }} />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-ink-900">{emp.name} <Text className="font-mono text-xs text-ink-500">({emp.emp_code})</Text></Text>
                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    {missingFieldLabels(emp).map(f => (
                      <View key={f} className="bg-white rounded-full px-2 py-0.5">
                        <Text className="text-xs font-semibold text-status-pending">{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  )
}
