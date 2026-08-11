import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { CheckCircle2 } from 'lucide-react-native'

interface CheckedInRow {
  id: string
  employee_id: string
  check_in_time: string
  checkpoint2_confirmed_by: string | null
  employees: { name: string; emp_code: string; department: string } | null
}

export default function SecurityCheckpoint2Screen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [rows, setRows] = useState<CheckedInRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const fetchCheckedIn = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance_records')
      .select('id, employee_id, check_in_time, checkpoint2_confirmed_by, employees(name, emp_code, department)')
      .eq('date', today)
      .not('check_in_time', 'is', null)
      .order('check_in_time', { ascending: true })
    if (data) setRows(data as unknown as CheckedInRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchCheckedIn() }, [fetchCheckedIn])

  if (!employee) return <LoadingScreen />

  const confirmSeen = async (row: CheckedInRow) => {
    setConfirmingId(row.id)
    const { error } = await supabase
      .from('attendance_records')
      .update({ checkpoint2_confirmed_by: employee.id, checkpoint2_at: new Date().toISOString() })
      .eq('id', row.id)
    setConfirmingId(null)
    if (!error) fetchCheckedIn()
    else Alert.alert(t('common.error'), t('common.somethingWentWrong'))
  }

  const pending = rows.filter(r => !r.checkpoint2_confirmed_by)
  const confirmed = rows.filter(r => r.checkpoint2_confirmed_by)

  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <FlatList
        data={pending}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-xs text-gray-500 mb-3 px-1">{t('security.checkpointHint')}</Text>
            <Text className="text-sm font-semibold text-gray-600">
              {t('security.pendingConfirmation')} ({pending.length})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Card className="items-center py-10">
            <CheckCircle2 size={32} color="#16A34A" />
            <Text className="text-center text-gray-500 mt-3">{t('security.allConfirmed')}</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900">{item.employees?.name}</Text>
                <Text className="text-xs text-gray-500">{item.employees?.emp_code} • {item.employees?.department}</Text>
              </View>
              <Button
                title="security.confirmSeen"
                onPress={() => confirmSeen(item)}
                loading={confirmingId === item.id}
                size="sm"
                icon={<CheckCircle2 size={16} color="white" />}
              />
            </View>
          </Card>
        )}
        ListFooterComponent={
          confirmed.length > 0 ? (
            <View className="mt-4">
              <Text className="text-sm font-semibold text-gray-600 mb-2">{t('security.confirmed')} ({confirmed.length})</Text>
              {confirmed.map(row => (
                <Card key={row.id} className="mb-2">
                  <View className="flex-row items-center gap-3">
                    <CheckCircle2 size={18} color="#16A34A" />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-gray-900">{row.employees?.name}</Text>
                      <Text className="text-xs text-gray-500">{row.employees?.emp_code} • {row.employees?.department}</Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  )
}
