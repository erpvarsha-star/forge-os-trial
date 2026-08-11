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
import { CheckCircle, XCircle, Inbox } from 'lucide-react-native'
import { INK } from '@/components/theme'

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

  const waitingLabel = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
    return days <= 0 ? t('common.today') : t('common.waitingDays', { count: days })
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.finalEscalation')}</Text>
          {items.length > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: items.length })}</Text>
            </View>
          )}
        </View>

        {items.length === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('owner.noEscalations')}</Text>
          </Card>
        ) : (
          items.map((item: any) => {
            const isLeave = !!item.type
            return (
              <Card key={item.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-ink-900">{item.employee?.name}</Text>
                    <Text className="text-xs text-ink-500 mt-0.5">{item.employee?.department}</Text>
                  </View>
                  <View className="items-end">
                    {isLeave ? (
                      <View className="bg-ink-100 rounded-full px-2 py-0.5"><Text className="text-xs font-semibold text-ink-600">{item.type}</Text></View>
                    ) : (
                      <Text className="text-lg font-bold text-brand-600 font-mono">₹{item.amount.toLocaleString()}</Text>
                    )}
                    <Text className="text-xs text-ink-400 mt-1">{waitingLabel(item.created_at)}</Text>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Button title="supervisor.approve" onPress={() => approve(isLeave ? 'leave_requests' : 'advance_requests', item.id)} size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                  <Button title="supervisor.reject" onPress={() => reject(isLeave ? 'leave_requests' : 'advance_requests', item.id)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
                </View>
              </Card>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
