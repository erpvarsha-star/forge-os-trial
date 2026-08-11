import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { LeaveRequest, AdvanceRequest } from '@/types'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native'

export default function SupervisorApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [advances, setAdvances] = useState<AdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  // Leave and advance rejections share one modal — without tracking which
  // kind is being rejected, confirming an advance rejection ran the leave
  // UPDATE against leave_requests using an advance_requests id, matching no
  // rows and silently doing nothing.
  const [rejectingType, setRejectingType] = useState<'leave' | 'advance'>('leave')

  useEffect(() => { fetchApprovals() }, [employee])

  const fetchApprovals = async () => {
    if (!employee) return
    const { data: team } = await supabase.from('employees').select('id').eq('supervisor_id', employee.id)
    if (!team) { setIsLoading(false); return }
    const ids = team.map(t => t.id)
    const [{ data: leaveData }, { data: advanceData }] = await Promise.all([
      supabase.from('leave_requests').select('*, employee:employees(*)').in('employee_id', ids).eq('status', 'pending'),
      supabase.from('advance_requests').select('*, employee:employees(*)').in('employee_id', ids).eq('status', 'pending'),
    ])
    if (leaveData) setLeaves(leaveData as LeaveRequest[])
    if (advanceData) setAdvances(advanceData as AdvanceRequest[])
    setIsLoading(false)
  }

  const approveLeave = async (id: string) => {
    await supabase.from('leave_requests').update({ status: 'approved', approved_by: employee!.id, approved_at: new Date().toISOString() }).eq('id', id)
    fetchApprovals()
  }

  const approveAdvance = async (id: string, amount: number) => {
    // outstanding_balance starts at the full amount — payroll recovery
    // (advance_recovery on payroll_records) draws this down over
    // repayment_months.
    await supabase
      .from('advance_requests')
      .update({ status: 'approved', approved_by: employee!.id, approved_at: new Date().toISOString(), outstanding_balance: amount })
      .eq('id', id)
    fetchApprovals()
  }

  const confirmRejection = async () => {
    if (!rejectingId) return
    if (rejectingType === 'advance') {
      // advance_requests has no rejection_reason column (see FINAL_SCHEMA) —
      // only the status fields are written here.
      await supabase
        .from('advance_requests')
        .update({ status: 'rejected', approved_by: employee!.id, approved_at: new Date().toISOString() })
        .eq('id', rejectingId)
    } else {
      await supabase
        .from('leave_requests')
        .update({ status: 'rejected', approved_by: employee!.id, approved_at: new Date().toISOString(), rejection_reason: rejectionReason })
        .eq('id', rejectingId)
    }
    setRejectingId(null); setRejectionReason(''); fetchApprovals()
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-lg font-bold text-gray-900 mb-2">{t('supervisor.pendingLeaves')}</Text>
        {leaves.map(req => (
          <Card key={req.id} className="mb-2">
            <View className="mb-2">
              <Text className="text-sm font-bold text-gray-900">{req.employee?.name} ({req.employee?.emp_code})</Text>
              <Text className="text-xs text-gray-500">{req.type}: {req.start_date} to {req.end_date} ({req.days} days)</Text>
              <Text className="text-xs text-gray-600 mt-1">{req.reason}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button title="supervisor.approve" onPress={() => approveLeave(req.id)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
              <Button title="supervisor.reject" onPress={() => { setRejectingType('leave'); setRejectingId(req.id) }} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
            </View>
          </Card>
        ))}
        {advances.length > 0 && <Text className="text-lg font-bold text-gray-900 mb-2 mt-4">{t('common.advance')} {t('common.approvals')}</Text>}
        {advances.map(req => (
          <Card key={req.id} className="mb-2">
            <View className="mb-2">
              <Text className="text-sm font-bold text-gray-900">{req.employee?.name}</Text>
              <Text className="text-xs text-gray-500">₹{req.amount} • {req.repayment_months} months</Text>
              <Text className="text-xs text-gray-600 mt-1">{req.reason}</Text>
            </View>
            <View className="flex-row gap-2">
              <Button title="supervisor.approve" onPress={() => approveAdvance(req.id, req.amount)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
              <Button title="supervisor.reject" onPress={() => { setRejectingType('advance'); setRejectingId(req.id) }} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
            </View>
          </Card>
        ))}
      </ScrollView>
      <Modal visible={!!rejectingId} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('supervisor.reject')}</Text>
            {rejectingType === 'leave' && (
              <Input value={rejectionReason} onChangeText={setRejectionReason} placeholder={t('common.reason')} multiline numberOfLines={3} className="mb-4" />
            )}
            <Button title="common.confirm" onPress={confirmRejection} />
            <Button title="common.cancel" onPress={() => setRejectingId(null)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
