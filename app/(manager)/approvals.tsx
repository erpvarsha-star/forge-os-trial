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
import { AlertTriangle, CheckCircle, XCircle, Inbox } from 'lucide-react-native'
import { INK, STATUS } from '@/components/theme'

export default function ManagerApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [advances, setAdvances] = useState<AdvanceRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { fetchApprovals() }, [employee])

  const fetchApprovals = async () => {
    if (!employee) return
    const { data: supervisors } = await supabase.from('employees').select('id').eq('manager_id', employee.id)
    if (!supervisors) { setIsLoading(false); return }
    const supIds = supervisors.map(s => s.id)
    const { data: team } = await supabase.from('employees').select('id').in('supervisor_id', supIds)
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

  const totalPending = leaves.length + advances.length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('manager.escalatedApprovals')}</Text>
          {totalPending > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: totalPending })}</Text>
            </View>
          )}
        </View>

        {totalPending === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('manager.noEscalations')}</Text>
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
                        <Text className="text-xs text-ink-500 mt-0.5">{req.employee?.department}</Text>
                      </View>
                      <Text className="text-xs text-ink-400">{waitingLabel(req.created_at)}</Text>
                    </View>
                    <View className="flex-row items-center gap-2 mb-3">
                      <View className="bg-ink-100 rounded-full px-2 py-0.5"><Text className="text-xs font-semibold text-ink-600">{req.type}</Text></View>
                      <Text className="text-xs text-ink-500">{req.start_date} → {req.end_date}</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Button title="supervisor.approve" onPress={() => approve('leave_requests', req.id)} size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                      <Button title="supervisor.reject" onPress={() => reject('leave_requests', req.id)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
                    </View>
                  </Card>
                ))}
              </>
            )}

            {advances.length > 0 && (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">{t('supervisor.advanceApprovals')}</Text>
                {advances.map(req => {
                  const isRisky = req.amount > (req.employee?.salary || 0) * 0.3
                  return (
                    <Card key={req.id} className="mb-3">
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1 pr-2">
                          <Text className="text-base font-bold text-ink-900">{req.employee?.name}</Text>
                          <Text className="text-xs text-ink-500 mt-0.5">{req.employee?.department}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-lg font-bold text-brand-600 font-mono">₹{req.amount.toLocaleString()}</Text>
                          <Text className="text-xs text-ink-400">{waitingLabel(req.created_at)}</Text>
                        </View>
                      </View>
                      {isRisky && (
                        <View className="flex-row items-center gap-1.5 mb-3 bg-status-rejected-bg rounded-lg px-2.5 py-1.5 self-start">
                          <AlertTriangle size={14} color={STATUS.rejected.fg} />
                          <Text className="text-xs font-semibold text-status-rejected">{t('manager.advanceSafetyCheck')}</Text>
                        </View>
                      )}
                      <View className="flex-row gap-2">
                        <Button title="supervisor.approve" onPress={() => approve('advance_requests', req.id)} size="sm" className="flex-1" icon={<CheckCircle size={14} color="white" />} />
                        <Button title="supervisor.reject" onPress={() => reject('advance_requests', req.id)} variant="danger" size="sm" className="flex-1" icon={<XCircle size={14} color="white" />} />
                      </View>
                    </Card>
                  )
                })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
