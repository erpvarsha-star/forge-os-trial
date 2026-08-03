import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { LeaveRequest, AdvanceRequest } from '@/types'
import { CheckCircle, XCircle } from 'lucide-react-native'

export default function OwnerApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [items, setItems] = useState<(LeaveRequest | AdvanceRequest)[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchApprovals() }, [employee])

  const fetchApprovals = async () => {
    if (!employee) return
    const [{ data: leaves }, { data: advances }] = await Promise.all([
      supabase.from('leave_requests').select('*, employee:employees(*)').eq('status', 'pending'),
      supabase.from('advance_requests').select('*, employee:employees(*)').eq('status', 'pending'),
    ])
    const all = [...(leaves || []), ...(advances || [])]
    setItems(all as any)
    setIsLoading(false)
  }

  const approve = async (table: string, id: string) => {
    await supabase.from(table).update({ status: 'approved', approved_by: employee!.id, approved_at: new Date().toISOString() }).eq('id', id)
    fetchApprovals()
  }

  const reject = async (table: string, id: string) => {
    await supabase.from(table).update({ status: 'rejected', approved_by: employee!.id, approved_at: new Date().toISOString() }).eq('id', id)
    fetchApprovals()
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('owner.finalEscalation')}</Text>
        {items.map((item: any) => (
          <Card key={item.id} className="mb-2">
            <Text className="text-sm font-bold text-gray-900">{item.employee?.name} ({item.employee?.department})</Text>
            <Text className="text-xs text-gray-500">{item.type || `₹${item.amount}`}</Text>
            <View className="flex-row gap-2 mt-2">
              <Button title="supervisor.approve" onPress={() => approve(item.type ? 'leave_requests' : 'advance_requests', item.id)} size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
              <Button title="supervisor.reject" onPress={() => reject(item.type ? 'leave_requests' : 'advance_requests', item.id)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
