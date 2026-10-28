import React, { useState } from 'react'
import { View, Text, ScrollView, Modal, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { LEAVE_TYPES } from '@/constants'
import { stageProgressLabel } from '@/lib/approvalStages'
import { computeDays, hoursBetween, EXTRA_WORK_MAX, ExtraWorkBlock, HalfDay } from '@/lib/leaveForm'
import { Plus, FileText } from 'lucide-react-native'

const emptyExtraWork = (): ExtraWorkBlock => ({ date: '', time_from: '', time_to: '', hours: 0, details: '' })

export function LeaveScreen() {
  const { t, i18n } = useTranslation()
  const isHindi = i18n.language === 'hi'
  const { employee } = useAuth()
  const { requests, balance, isLoading, applyLeave } = useLeave(employee?.id || '')
  const [showModal, setShowModal] = useState(false)
  const [leaveType, setLeaveType] = useState('EL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [startHalf, setStartHalf] = useState<HalfDay>(null)
  const [endHalf, setEndHalf] = useState<HalfDay>(null)
  const [daysOverride, setDaysOverride] = useState('')
  const [daysTouched, setDaysTouched] = useState(false)
  const [odPlace, setOdPlace] = useState('')
  const [odPurpose, setOdPurpose] = useState('')
  const [odTimeFrom, setOdTimeFrom] = useState('')
  const [odTimeTo, setOdTimeTo] = useState('')
  const [extraWork, setExtraWork] = useState<ExtraWorkBlock[]>([emptyExtraWork()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee || isLoading) return <LoadingScreen />

  const computedDays = computeDays(startDate, endDate, startHalf, endHalf)
  const days = daysTouched && daysOverride !== '' ? parseFloat(daysOverride) : computedDays

  // Sheet rule: warn but NEVER block when the request exceeds the remaining balance.
  const balanceForType = (type: string): number | null => {
    if (!balance) return null
    if (type === 'EL') return balance.earned_leave
    if (type === 'CL') return balance.casual_leave
    if (type === 'SL') return balance.sick_leave
    return null // LWP/OD/COFF have no EL/CL/SL balance to check
  }

  const updateExtraWork = (i: number, patch: Partial<ExtraWorkBlock>) => {
    setExtraWork(prev => prev.map((b, idx) => {
      if (idx !== i) return b
      const next = { ...b, ...patch }
      if (patch.time_from !== undefined || patch.time_to !== undefined) {
        next.hours = hoursBetween(next.time_from, next.time_to)
      }
      return next
    }))
  }

  const resetForm = () => {
    setLeaveType('EL'); setStartDate(''); setEndDate(''); setReason('')
    setStartHalf(null); setEndHalf(null); setDaysOverride(''); setDaysTouched(false)
    setOdPlace(''); setOdPurpose(''); setOdTimeFrom(''); setOdTimeTo('')
    setExtraWork([emptyExtraWork()])
  }

  const handleApply = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    if (leaveType === 'OD' && (!odPlace || !odPurpose || !odTimeFrom || !odTimeTo)) {
      Alert.alert(t('common.error'), t('leave.odFieldsRequired'))
      return
    }
    if (leaveType === 'COFF' && extraWork.every(b => !b.date)) {
      Alert.alert(t('common.error'), t('leave.extraWorkRequired'))
      return
    }
    const finalDays = days || computedDays
    const remaining = balanceForType(leaveType)
    if (remaining !== null && finalDays > remaining) {
      Alert.alert(
        t('leave.insufficientBalanceTitle'),
        t('leave.insufficientBalanceMsg', { requested: finalDays, remaining, type: leaveType }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('leave.proceedAnyway'), onPress: () => submitLeave(finalDays) },
        ]
      )
      return
    }
    await submitLeave(finalDays)
  }

  const submitLeave = async (finalDays: number) => {
    setIsSubmitting(true)
    const detail: Record<string, unknown> = {}
    if (startHalf) detail.start_half = startHalf
    if (endHalf) detail.end_half = endHalf
    if (leaveType === 'OD') {
      detail.place = odPlace; detail.purpose = odPurpose
      detail.time_from = odTimeFrom; detail.time_to = odTimeTo
    }
    if (leaveType === 'COFF') {
      detail.extra_work = extraWork.filter(b => !!b.date)
    }
    await applyLeave({
      type: leaveType as any,
      start_date: startDate,
      end_date: endDate,
      days: finalDays,
      reason,
      detail: Object.keys(detail).length ? detail as any : null,
    })
    setIsSubmitting(false)
    setShowModal(false)
    resetForm()
  }

  const leaveTypeLabel = (value: string) => {
    const match = LEAVE_TYPES.find(lt => lt.value === value)
    if (!match) return value
    return isHindi ? match.labelHi : match.label
  }

  const halfChip = (value: 'first' | 'second', current: HalfDay, onSelect: (h: HalfDay) => void) => (
    <TouchableOpacity
      onPress={() => onSelect(current === value ? null : value)}
      className={`px-3 py-1.5 rounded-lg border ${current === value ? 'bg-brand-600 border-brand-600' : 'border-ink-300'}`}
    >
      <Text className={`text-xs ${current === value ? 'text-white' : 'text-ink-700'}`}>{t(`leave.half_${value}`)}</Text>
    </TouchableOpacity>
  )

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50'
      case 'rejected': return 'text-red-600 bg-red-50'
      default: return 'text-yellow-600 bg-yellow-50'
    }
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Card title={t('worker.leaveBalance')}>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">{balance?.earned_leave || 0}</Text>
              <Text className="text-xs text-ink-500">{t('worker.earnedLeave')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">{balance?.casual_leave || 0}</Text>
              <Text className="text-xs text-ink-500">{t('worker.casualLeave')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-brand-600">{balance?.sick_leave || 0}</Text>
              <Text className="text-xs text-ink-500">{t('worker.sickLeave')}</Text>
            </View>
          </View>
        </Card>

        <View className="mt-4 mb-2 flex-row justify-between items-center">
          <Text className="text-lg font-bold text-ink-900">{t('worker.leaveRequests')}</Text>
          <Button
            title="worker.applyLeave"
            onPress={() => setShowModal(true)}
            variant="outline"
            size="sm"
            icon={<Plus size={16} color="#E65C00" />}
          />
        </View>

        {requests.length === 0 ? (
          <Card className="items-center py-10">
            <FileText size={32} color="#D1D5DB" />
            <Text className="text-sm text-ink-500 mt-3">{t('worker.noLeaveRequests')}</Text>
          </Card>
        ) : (
          requests.map(req => (
            <Card key={req.id} className="mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-ink-900">{leaveTypeLabel(req.type)}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5">
                    {req.start_date}{req.start_date !== req.end_date ? ` – ${req.end_date}` : ''}
                  </Text>
                  <Text className="text-xs text-ink-600 mt-1">{req.reason}</Text>
                  {req.status === 'pending' && !!stageProgressLabel(req.current_stage ?? 0, req.approval_chain) && (
                    <Text className="text-xs text-ink-400 mt-1">{stageProgressLabel(req.current_stage ?? 0, req.approval_chain)}</Text>
                  )}
                </View>
                <View className={`px-2 py-1 rounded-full ${statusColor(req.status)}`}>
                  <Text className="text-xs font-medium capitalize">{t(`common.${req.status}`)}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl p-6 max-h-[90%]">
            <Text className="text-lg font-bold text-ink-900 mb-4">{t('worker.applyLeave')}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm font-medium text-ink-700 mb-2">{t('worker.leaveType')}</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {LEAVE_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    onPress={() => setLeaveType(type.value)}
                    className={`px-3 py-2 rounded-lg border ${leaveType === type.value ? 'bg-brand-600 border-brand-600' : 'border-ink-300'}`}
                  >
                    <Text className={`text-sm ${leaveType === type.value ? 'text-white' : 'text-ink-700'}`}>
                      {isHindi ? type.labelHi : type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label={t('worker.startDate')} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
              <View className="flex-row gap-2 mb-3 -mt-1">
                {halfChip('first', startHalf, setStartHalf)}
                {halfChip('second', startHalf, setStartHalf)}
              </View>
              <Input label={t('worker.endDate')} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              <View className="flex-row gap-2 mb-3 -mt-1">
                {halfChip('first', endHalf, setEndHalf)}
                {halfChip('second', endHalf, setEndHalf)}
              </View>
              <Input
                label={t('leave.days') + (daysTouched ? ` (${t('leave.daysOverridden')})` : '')}
                value={daysOverride}
                onChangeText={v => { setDaysOverride(v); setDaysTouched(true) }}
                placeholder={String(computedDays || '0.5')}
                keyboardType="numeric"
              />
              {leaveType === 'OD' && (
                <View className="mt-2">
                  <Input label={t('leave.odPlace')} value={odPlace} onChangeText={setOdPlace} />
                  <Input label={t('leave.odPurpose')} value={odPurpose} onChangeText={setOdPurpose} multiline numberOfLines={2} />
                  <View className="flex-row gap-2">
                    <View className="flex-1"><Input label={t('leave.odTimeFrom')} value={odTimeFrom} onChangeText={setOdTimeFrom} placeholder="09:00" /></View>
                    <View className="flex-1"><Input label={t('leave.odTimeTo')} value={odTimeTo} onChangeText={setOdTimeTo} placeholder="17:00" /></View>
                  </View>
                </View>
              )}
              {leaveType === 'COFF' && (
                <View className="mt-2">
                  <Text className="text-sm font-medium text-ink-700 mb-2">{t('leave.extraWork')}</Text>
                  {extraWork.map((block, i) => (
                    <View key={i} className="border border-ink-200 rounded-lg p-3 mb-2">
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-xs font-semibold text-ink-500">{t('leave.extraWorkBlock', { index: i + 1 })}</Text>
                        {extraWork.length > 1 && (
                          <TouchableOpacity onPress={() => setExtraWork(prev => prev.filter((_, idx) => idx !== i))}>
                            <Text className="text-xs text-red-500">{t('leave.removeBlock')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Input label={t('leave.extraWorkDate')} value={block.date} onChangeText={v => updateExtraWork(i, { date: v })} placeholder="YYYY-MM-DD" />
                      <View className="flex-row gap-2">
                        <View className="flex-1"><Input label={t('leave.odTimeFrom')} value={block.time_from} onChangeText={v => updateExtraWork(i, { time_from: v })} placeholder="09:00" /></View>
                        <View className="flex-1"><Input label={t('leave.odTimeTo')} value={block.time_to} onChangeText={v => updateExtraWork(i, { time_to: v })} placeholder="17:00" /></View>
                      </View>
                      {block.hours > 0 && <Text className="text-xs text-ink-500 mb-2">{t('leave.extraWorkHours', { hours: block.hours })}</Text>}
                      <Input label={t('leave.extraWorkDetails')} value={block.details} onChangeText={v => updateExtraWork(i, { details: v })} multiline numberOfLines={2} />
                    </View>
                  ))}
                  {extraWork.length < EXTRA_WORK_MAX && (
                    <Button title="leave.addExtraWork" onPress={() => setExtraWork(prev => [...prev, emptyExtraWork()])} variant="outline" size="sm" className="mb-3" />
                  )}
                </View>
              )}
              <Input label={t('worker.leaveReason')} value={reason} onChangeText={setReason} multiline numberOfLines={3} className="mb-4" />
              <Button title="common.submit" onPress={handleApply} loading={isSubmitting} />
              <Button title="common.cancel" onPress={() => setShowModal(false)} variant="ghost" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default LeaveScreen
