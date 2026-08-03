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
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native'

export default function PlantHeadApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [advances, setAdvances] = useState<AdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchApprovals() }, [employee])

  const fetchApprovals = async () => {
    if (!employee) return
    const [{ data: leaveData }, { data: advanceData }] = await Promise.all([
      supabase.from('leave_requests').select('*, employee:employees(*)').eq('status', 'pending'),
      supabase.from('advance_requests').select('*, employee:employees(*)').eq('status', 'pending'),
    ])
    if (leaveData) setLeaves(leaveData as LeaveRequest[])
    if (advanceData) setAdvances(advanceData as AdvanceRequest[])
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
        <Text className="text-lg font-bold text-gray-900 mb-2">{t('plantHead.pendingSignOff')}</Text>
        {leaves.map(req => (
          <Card key={req.id} className="mb-2">
            <Text className="text-sm font-bold text-gray-900">{req.employee?.name} ({req.employee?.department})</Text>
            <Text className="text-xs text-gray-500">{req.type}: {req.start_date} to {req.end_date}</Text>
            <View className="flex-row gap-2 mt-2">
              <Button title="supervisor.approve" onPress={() => approve('leave_requests', req.id)} size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
              <Button title="supervisor.reject" onPress={() => reject('leave_requests', req.id)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
            </View>
          </Card>
        ))}
        {advances.map(req => (
          <Card key={req.id} className="mb-2">
            <Text className="text-sm font-bold text-gray-900">{req.employee?.name}</Text>
            <Text className="text-xs text-gray-500">₹{req.amount}</Text>
            {req.amount > 30000 && (
              <View className="flex-row items-center gap-1 mt-1"><AlertTriangle size={14} className="text-red-600" /><Text className="text-xs text-red-600">{t('plantHead.advanceThreshold')}</Text></View>
            )}
            <View className="flex-row gap-2 mt-2">
              <Button title="supervisor.approve" onPress={() => approve('advance_requests', req.id)} size="sm" className="flex-1" />
              <Button title="supervisor.reject" onPress={() => reject('advance_requests', req.id)} variant="danger" size="sm" className="flex-1" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
