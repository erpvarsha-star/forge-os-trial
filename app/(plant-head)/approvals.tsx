import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLeaveAdvanceApprovals } from '@/hooks/useLeaveAdvanceApprovals'
import { LeaveAdvanceApprovalCards } from '@/components/LeaveAdvanceApprovalCards'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Inbox } from 'lucide-react-native'
import { INK } from '@/components/theme'

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
  const { leaves, advances, isLoading: leaveAdvanceLoading, actingId, reviewLeave, reviewAdvance } = useLeaveAdvanceApprovals()
  const [salaryItems, setSalaryItems] = useState<SalaryChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [salaryActingId, setSalaryActingId] = useState<string | null>(null)

  useEffect(() => { fetchSalary() }, [employee])

  const fetchSalary = async () => {
    if (!employee) return
    const { data } = await supabase
      .from('salary_change_requests')
      .select('*, employee:employees!employee_id(name, emp_code, department)')
      .eq('status', 'pending_plant_head')
      .order('requested_at', { ascending: true })
    setSalaryItems((data || []) as any)
    setIsLoading(false)
  }

  const reviewSalary = async (req: SalaryChangeRequest, approve: boolean) => {
    setSalaryActingId(req.id)
    const { error } = await supabase.rpc('plant_head_review_salary_change_request', {
      p_request_id: req.id,
      p_approve: approve,
    })
    setSalaryActingId(null)
    if (error) {
      Alert.alert(t('common.error'), t('common.somethingWentWrong'))
      return
    }
    fetchSalary()
  }

  if (!employee) return <LoadingScreen />
  if (isLoading || leaveAdvanceLoading) return <LoadingScreen />

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
                    loading={salaryActingId === req.id}
                    size="sm"
                    className="flex-1"
                    icon={<CheckCircle size={14} color="white" />}
                  />
                  <Button
                    title="supervisor.reject"
                    onPress={() => reviewSalary(req, false)}
                    loading={salaryActingId === req.id}
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
          <LeaveAdvanceApprovalCards
            leaves={leaves}
            advances={advances}
            actingId={actingId}
            onReviewLeave={reviewLeave}
            onReviewAdvance={reviewAdvance}
          />
        )}
      </ScrollView>
    </View>
  )
}
