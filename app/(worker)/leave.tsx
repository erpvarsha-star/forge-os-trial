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
import { Plus, Calendar, CheckCircle, XCircle, Clock, FileText } from 'lucide-react-native'

export default function WorkerLeave() {
  const { t, i18n } = useTranslation()
  const isHindi = i18n.language === 'hi'
  const { employee } = useAuth()
  const { requests, balance, isLoading, applyLeave, refresh } = useLeave(employee?.id || '')
  const [showModal, setShowModal] = useState(false)
  const [leaveType, setLeaveType] = useState('EL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const leaveTypeLabel = (value: string) => {
    const match = LEAVE_TYPES.find(lt => lt.value === value)
    if (!match) return value
    return isHindi ? match.labelHi : match.label
  }

  const handleApply = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    setIsSubmitting(true)
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    await applyLeave({ type: leaveType as any, start_date: startDate, end_date: endDate, days, reason })
    setIsSubmitting(false)
    setShowModal(false)
    setStartDate('')
    setEndDate('')
    setReason('')
  }

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
                    {req.start_date} {req.start_date !== req.end_date ? `– ${req.end_date}` : ''}
                  </Text>
                  <Text className="text-xs text-ink-600 mt-1">{req.reason}</Text>
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
                    className={`px-3 py-2 rounded-lg border ${
                      leaveType === type.value ? 'bg-brand-600 border-brand-600' : 'border-ink-300'
                    }`}
                  >
                    <Text className={`text-sm ${leaveType === type.value ? 'text-white' : 'text-ink-700'}`}>
                      {isHindi ? type.labelHi : type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label={t('worker.startDate')} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
              <Input label={t('worker.endDate')} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              <Input
                label={t('worker.leaveReason')}
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                className="mb-4"
              />
              <Button title="common.submit" onPress={handleApply} loading={isSubmitting} />
              <Button title="common.cancel" onPress={() => setShowModal(false)} variant="ghost" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
