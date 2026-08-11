import React, { useState } from 'react'
import { View, Text, ScrollView, Modal, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useAdvance } from '@/hooks/useAdvance'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { Plus, Wallet, Clock, CheckCircle, XCircle } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'

export default function AdvanceScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { requests, isLoading, applyAdvance, refresh } = useAdvance(employee?.id || '')
  const [showModal, setShowModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [repaymentMonths, setRepaymentMonths] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const outstanding = requests
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.outstanding_balance, 0)

  const handleApply = async () => {
    if (!amount || !repaymentMonths || !reason) {
      Alert.alert(t('common.error'), t('common.required'))
      return
    }
    setIsSubmitting(true)
    await applyAdvance({
      amount: parseFloat(amount),
      repayment_months: parseInt(repaymentMonths),
      reason,
    })
    setIsSubmitting(false)
    setShowModal(false)
    setAmount('')
    setRepaymentMonths('')
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
        <Card className="mb-4">
          <View className="flex-row items-center gap-3">
            <Wallet size={24} className="text-brand-600" />
            <View>
              <Text className="text-2xl font-bold text-ink-900">₹{outstanding.toFixed(2)}</Text>
              <Text className="text-sm text-ink-500">{t('worker.advanceBalance')}</Text>
            </View>
          </View>
        </Card>

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-lg font-bold text-ink-900">{t('worker.advanceRequests')}</Text>
          <Button
            title="worker.applyAdvance"
            onPress={() => setShowModal(true)}
            variant="outline"
            size="sm"
            icon={<Plus size={16} color="#E65C00" />}
          />
        </View>

        {requests.length === 0 ? (
          <Card className="items-center py-10">
            <Wallet size={32} color="#D1D5DB" />
            <Text className="text-sm text-ink-500 mt-3">{t('worker.noAdvanceRequests')}</Text>
          </Card>
        ) : (
          requests.map(req => (
            <Card key={req.id} className="mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-ink-900">₹{req.amount.toFixed(2)}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5">{req.reason}</Text>
                  <Text className="text-xs text-ink-500">{t('worker.repaymentMonths')}: {req.repayment_months}</Text>
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
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-lg font-bold text-ink-900 mb-4">{t('worker.applyAdvance')}</Text>
            <Input
              label={t('worker.advanceAmount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder={t('worker.advanceAmountPlaceholder')}
            />
            <Input
              label={t('worker.repaymentMonths')}
              value={repaymentMonths}
              onChangeText={setRepaymentMonths}
              keyboardType="numeric"
              placeholder={t('worker.repaymentMonthsPlaceholder')}
            />
            <Input
              label={t('worker.advanceReason')}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              className="mb-4"
            />
            <Button title="common.submit" onPress={handleApply} loading={isSubmitting} />
            <Button title="common.cancel" onPress={() => setShowModal(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
