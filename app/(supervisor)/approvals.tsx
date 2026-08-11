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
import { CheckCircle, XCircle, Inbox } from 'lucide-react-native'
import { INK } from '@/components/theme'

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

  // Presentational only — how long a request has been sitting in the queue.
  const waitingLabel = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
    return days <= 0 ? t('common.today') : t('common.waitingDays', { count: days })
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const totalPending = leaves.length + advances.length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('common.approvals')}</Text>
          {totalPending > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: totalPending })}</Text>
            </View>
          )}
        </View>

        {totalPending === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('common.allClear')}</Text>
          </Card>
        ) : (
          <>
            {leaves.length > 0 && (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('supervisor.pendingLeaves')}</Text>
                {leaves.map(req => (
                  <Card key={req.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="text-base font-bold text-ink-900">{req.employee?.name}</Text>
                        <Text className="text-xs font-mono text-ink-500 mt-0.5">{req.employee?.emp_code}</Text>
                      </View>
                      <Text className="text-xs text-ink-400">{waitingLabel(req.created_at)}</Text>
                    </View>
                    <View className="flex-row flex-wrap items-center gap-2 mb-2">
                      <View className="bg-ink-100 rounded-full px-2 py-0.5">
                        <Text className="text-xs font-semibold text-ink-600">{req.type}</Text>
                      </View>
                      <Text className="text-xs text-ink-500">{req.start_date} → {req.end_date} ({req.days}d)</Text>
                    </View>
                    {!!req.reason && <Text className="text-sm text-ink-600 mb-3">{req.reason}</Text>}
                    <View className="flex-row gap-2">
                      <Button title="supervisor.approve" onPress={() => approveLeave(req.id)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                      <Button title="supervisor.reject" onPress={() => { setRejectingType('leave'); setRejectingId(req.id) }} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
                    </View>
                  </Card>
                ))}
              </>
            )}

            {advances.length > 0 && (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">{t('supervisor.advanceApprovals')}</Text>
                {advances.map(req => (
                  <Card key={req.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-1 pr-2">
                        <Text className="text-base font-bold text-ink-900">{req.employee?.name}</Text>
                        <Text className="text-xs font-mono text-ink-500 mt-0.5">{req.employee?.emp_code}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-brand-600 font-mono">₹{req.amount.toLocaleString()}</Text>
                        <Text className="text-xs text-ink-400">{waitingLabel(req.created_at)}</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-ink-500 mb-2">{req.repayment_months} {t('worker.repaymentMonths')}</Text>
                    {!!req.reason && <Text className="text-sm text-ink-600 mb-3">{req.reason}</Text>}
                    <View className="flex-row gap-2">
                      <Button title="supervisor.approve" onPress={() => approveAdvance(req.id, req.amount)} variant="primary" size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                      <Button title="supervisor.reject" onPress={() => { setRejectingType('advance'); setRejectingId(req.id) }} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <Modal visible={!!rejectingId} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-3">{t('supervisor.reject')}</Text>
            {rejectingType === 'leave' && (
              <Input value={rejectionReason} onChangeText={setRejectionReason} placeholder={t('common.reason')} multiline numberOfLines={3} className="mb-4" />
            )}
            <Button title="common.confirm" onPress={confirmRejection} variant="danger" className="mb-2" />
            <Button title="common.cancel" onPress={() => setRejectingId(null)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
