import React, { useState } from 'react'
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLeave } from '@/hooks/useLeave'
import { useAdvance } from '@/hooks/useAdvance'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LEAVE_TYPES } from '@/constants'
import { CheckCircle2, X } from 'lucide-react-native'

interface Props {
  visible: boolean
  kind: 'leave' | 'advance'
  formUrl: string
  onClose: () => void
}

// The transition plan Yash approved: moving Leave/Advance off pure Google
// Forms without shutting the working process down. Step 1 captures the
// same data in-app (feeding the new staged approval chain, PATCH_53) and
// shows a completion confirmation; step 2 still opens the existing Google
// Form. Both processes run independently side by side until the in-app
// flow is proven with no bugs — this modal does not replace the form link,
// it runs before it.
export function TwoStepFormModal({ visible, kind, formUrl, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const isHindi = i18n.language === 'hi'
  const { employee } = useAuth()
  const { applyLeave } = useLeave(employee?.id || '')
  const { applyAdvance } = useAdvance(employee?.id || '')

  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [leaveType, setLeaveType] = useState('EL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [leaveReason, setLeaveReason] = useState('')

  const [amount, setAmount] = useState('')
  const [repaymentMonths, setRepaymentMonths] = useState('')
  const [advanceReason, setAdvanceReason] = useState('')

  const reset = () => {
    setStep('form')
    setLeaveType('EL'); setStartDate(''); setEndDate(''); setLeaveReason('')
    setAmount(''); setRepaymentMonths(''); setAdvanceReason('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (kind === 'leave') {
      if (!startDate || !endDate || !leaveReason) {
        Alert.alert(t('common.error'), t('common.required'))
        return
      }
      setIsSubmitting(true)
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      const { error } = await applyLeave({ type: leaveType as any, start_date: startDate, end_date: endDate, days, reason: leaveReason })
      setIsSubmitting(false)
      if (error) { Alert.alert(t('common.error'), t('common.somethingWentWrong')); return }
      setStep('confirm')
    } else {
      if (!amount || !repaymentMonths || !advanceReason) {
        Alert.alert(t('common.error'), t('common.required'))
        return
      }
      setIsSubmitting(true)
      const { error } = await applyAdvance({ amount: parseFloat(amount), repayment_months: parseInt(repaymentMonths), reason: advanceReason })
      setIsSubmitting(false)
      if (error) { Alert.alert(t('common.error'), t('common.somethingWentWrong')); return }
      setStep('confirm')
    }
  }

  const continueToForm = async () => {
    try {
      const supported = await Linking.canOpenURL(formUrl)
      if (supported) await Linking.openURL(formUrl)
    } finally {
      handleClose()
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-2xl p-6 max-h-[90%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-ink-900">
              {step === 'form'
                ? t(kind === 'leave' ? 'worker.applyLeave' : 'worker.applyAdvance')
                : t('forms.step1Complete')}
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-1">
              <X size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {step === 'form' ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs text-ink-500 mb-4">{t('forms.step1Hint')}</Text>
              {kind === 'leave' ? (
                <>
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
                  <Input label={t('worker.endDate')} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
                  <Input label={t('worker.leaveReason')} value={leaveReason} onChangeText={setLeaveReason} multiline numberOfLines={3} className="mb-4" />
                </>
              ) : (
                <>
                  <Input label={t('worker.advanceAmount')} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={t('worker.advanceAmountPlaceholder')} />
                  <Input label={t('worker.repaymentMonths')} value={repaymentMonths} onChangeText={setRepaymentMonths} keyboardType="numeric" placeholder={t('worker.repaymentMonthsPlaceholder')} />
                  <Input label={t('worker.advanceReason')} value={advanceReason} onChangeText={setAdvanceReason} multiline numberOfLines={3} className="mb-4" />
                </>
              )}
              <Button title="common.submit" onPress={handleSubmit} loading={isSubmitting} />
              <Button title="common.cancel" onPress={handleClose} variant="ghost" />
            </ScrollView>
          ) : (
            <View className="items-center py-4">
              <View className="w-14 h-14 rounded-full bg-green-100 items-center justify-center mb-4">
                <CheckCircle2 size={28} color="#16A34A" />
              </View>
              <Text className="text-sm text-ink-600 text-center mb-6">{t('forms.step1CompleteHint')}</Text>
              <Button title="forms.continueToForm" onPress={continueToForm} className="w-full mb-2" icon={<CheckCircle2 size={18} color="white" />} />
              <Button title="common.close" onPress={handleClose} variant="ghost" className="w-full" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}
