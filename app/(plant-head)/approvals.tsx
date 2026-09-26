import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { LeaveRequest, AdvanceRequest } from '@/types'
import { CheckCircle, XCircle, AlertTriangle, Inbox } from 'lucide-react-native'
import { INK, STATUS } from '@/components/theme'

interface SalaryChangeRequest {
  id: string
  employee_id: string
  is_new_hire: boolean
  ctc_annual: number
  basic: number
  hra: number
  conveyance: number
  requested_at: string
  employee?: { name: string; emp_code: string; department: string }
}

export default function PlantHeadApprovals() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [advances, setAdvances] = useState<AdvanceRequest[]>([])
  const [salaryItems, setSalaryItems] = useState<SalaryChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => { fetchApprovals() }, [employee])

  const fetchApprovals = async () => {
    if (!employee) return
    const [{ data: leaveData }, { data: advanceData }, { data: salaryData }] = await Promise.all([
      supabase.from('leave_requests').select('*, employee:employees(*)').eq('status', 'pending'),
      supabase.from('advance_requests').select('*, employee:employees(*)').eq('status', 'pending'),
      supabase
        .from('salary_change_requests')
        .select('*, employee:employees(name, emp_code, department)')
        .eq('status', 'pending_plant_head')
        .order('requested_at', { ascending: true }),
    ])
    if (leaveData) setLeaves(leaveData as LeaveRequest[])
    if (advanceData) setAdvances(advanceData as AdvanceRequest[])
    setSalaryItems((salaryData || []) as any)
    setIsLoading(false)
  }

  const reviewSalary = async (req: SalaryChangeRequest, approve: boolean) => {
    setActingId(req.id)
    const { error } = await supabase.rpc('plant_head_review_salary_change_request', {
      p_request_id: req.id,
      p_approve: approve,
    })
    setActingId(null)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }
    fetchApprovals()
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

  const totalPending = leaves.length + advances.length + salaryItems.length

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('plantHead.pendingSignOff')}</Text>
          {totalPending > 0 && (
            <View className="bg-status-pending-bg px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-status-pending">{t('common.pendingCount', { count: totalPending })}</Text>
            </View>
          )}
        </View>

        {salaryItems.length > 0 && (
          <>
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
              {t('hrAdmin.salaryRequests')}
            </Text>
            {salaryItems.map(req => (
              <Card key={req.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-ink-900">{req.employee?.name}</Text>
                    <Text className="text-xs text-ink-500 mt-0.5 font-mono">
                      {req.employee?.emp_code} • {req.employee?.department}
                    </Text>
                  </View>
                  <View className="items-end">
                    <View className={`rounded-full px-2 py-0.5 ${req.is_new_hire ? 'bg-brand-50' : 'bg-ink-100'}`}>
                      <Text className={`text-xs font-semibold ${req.is_new_hire ? 'text-brand-700' : 'text-ink-600'}`}>
                        {req.is_new_hire ? t('hrAdmin.newHireBadge') : t('hrAdmin.salaryRevisionBadge')}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3 bg-ink-50 rounded-lg p-2.5">
                  <Text className="text-xs text-ink-600">{t('hrAdmin.ctcAnnual')}: <Text className="font-bold font-mono">₹{Number(req.ctc_annual).toLocaleString()}</Text></Text>
                  <Text className="text-xs text-ink-600">{t('hrAdmin.basic')}: <Text className="font-bold font-mono">₹{Number(req.basic).toLocaleString()}</Text></Text>
                  <Text className="text-xs text-ink-600">{t('hrAdmin.hra')}: <Text className="font-bold font-mono">₹{Number(req.hra).toLocaleString()}</Text></Text>
                  <Text className="text-xs text-ink-600">{t('hrAdmin.conveyance')}: <Text className="font-bold font-mono">₹{Number(req.conveyance).toLocaleString()}</Text></Text>
                </View>
                <View className="flex-row gap-2">
                  <Button
                    title="supervisor.approve"
                    onPress={() => reviewSalary(req, true)}
                    loading={actingId === req.id}
                    size="sm"
                    className="flex-1"
                    icon={<CheckCircle size={14} color="white" />}
                  />
                  <Button
                    title="supervisor.reject"
                    onPress={() => reviewSalary(req, false)}
                    loading={actingId === req.id}
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    icon={<XCircle size={14} color="white" />}
                  />
                </View>
              </Card>
            ))}
          </>
        )}

        {totalPending === 0 ? (
          <Card className="items-center py-10">
            <Inbox size={32} color={INK[300]} />
            <Text className="text-sm text-ink-500 mt-3 text-center">{t('plantHead.noSignOffs')}</Text>
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
                  const isRisky = req.amount > 30000
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
                          <Text className="text-xs font-semibold text-status-rejected">{t('plantHead.advanceThreshold')}</Text>
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
