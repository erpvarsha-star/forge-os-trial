import React, { useState } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { Save } from 'lucide-react-native'

export default function MRMScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [safety, setSafety] = useState('')
  const [quality, setQuality] = useState('')
  const [delivery, setDelivery] = useState('')
  const [cost, setCost] = useState('')
  const [morale, setMorale] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const now = new Date()
    await supabase.from('mrm_reviews').insert({
      department: employee.department,
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: now.getFullYear(),
      safety_score: parseFloat(safety) || 0,
      quality_score: parseFloat(quality) || 0,
      delivery_score: parseFloat(delivery) || 0,
      cost_score: parseFloat(cost) || 0,
      morale_score: parseFloat(morale) || 0,
      submitted_by: employee.id,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
    })
    setIsSubmitting(false)
    Alert.alert(t('common.success'), 'MRM review submitted')
  }

  const isOverdue = new Date().getDate() > 10

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        {isOverdue && <Card className="mb-4 bg-red-50 border-red-200"><Text className="text-sm text-red-600 font-bold">{t('manager.mrmOverdue')}</Text></Card>}
        <Card>
          <Text className="text-lg font-bold text-gray-900 mb-1">{t('manager.mrmForm')}</Text>
          <Text className="text-xs text-gray-500 mb-4">{t('manager.mrmDeadline')}</Text>
          <Input label="Safety Score (0-100)" value={safety} onChangeText={setSafety} keyboardType="numeric" maxLength={3} />
          <Input label="Quality Score (0-100)" value={quality} onChangeText={setQuality} keyboardType="numeric" maxLength={3} />
          <Input label="Delivery Score (0-100)" value={delivery} onChangeText={setDelivery} keyboardType="numeric" maxLength={3} />
          <Input label="Cost Score (0-100)" value={cost} onChangeText={setCost} keyboardType="numeric" maxLength={3} />
          <Input label="Morale Score (0-100)" value={morale} onChangeText={setMorale} keyboardType="numeric" maxLength={3} />
          <Button title="common.submit" onPress={handleSubmit} loading={isSubmitting} icon={<Save size={18} color="white" />} />
        </Card>
      </ScrollView>
    </View>
  )
}
