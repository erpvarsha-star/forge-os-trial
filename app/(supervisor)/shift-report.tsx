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

export default function ShiftReportScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [productionOutput, setProductionOutput] = useState('')
  const [qualityIssues, setQualityIssues] = useState('')
  const [downtime, setDowntime] = useState('')
  const [operatorTotals, setOperatorTotals] = useState('')
  const [supervisorTotal, setSupervisorTotal] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!employee) return <LoadingScreen />

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const opTotal = parseFloat(operatorTotals) || 0
    const supTotal = parseFloat(supervisorTotal) || 0
    const variance = supTotal > 0 ? Math.abs((supTotal - opTotal) / supTotal) * 100 : 0
    await supabase.from('data_collection_submissions').insert({
      supervisor_id: employee.id,
      date: new Date().toISOString().split('T')[0],
      production_output: parseFloat(productionOutput) || 0,
      quality_issues: parseInt(qualityIssues) || 0,
      downtime_minutes: parseInt(downtime) || 0,
      operator_totals: opTotal,
      supervisor_total: supTotal,
      variance_percent: variance,
    })
    setIsSubmitting(false)
    Alert.alert(t('common.success'), 'Shift report submitted')
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Card>
          <Input label={t('supervisor.productionOutput')} value={productionOutput} onChangeText={setProductionOutput} keyboardType="numeric" />
          <Input label={t('supervisor.qualityIssues')} value={qualityIssues} onChangeText={setQualityIssues} keyboardType="numeric" />
          <Input label={t('supervisor.downtimeMinutes')} value={downtime} onChangeText={setDowntime} keyboardType="numeric" />
          <Input label={t('supervisor.operatorTotal')} value={operatorTotals} onChangeText={setOperatorTotals} keyboardType="numeric" />
          <Input label={t('supervisor.supervisorTotal')} value={supervisorTotal} onChangeText={setSupervisorTotal} keyboardType="numeric" />
          {parseFloat(supervisorTotal) > 0 && parseFloat(operatorTotals) > 0 && (
            <Text className={`text-sm mb-4 ${Math.abs((parseFloat(supervisorTotal) - parseFloat(operatorTotals)) / parseFloat(supervisorTotal)) * 100 > 5 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
              {t('supervisor.varianceWarning')}: {((Math.abs(parseFloat(supervisorTotal) - parseFloat(operatorTotals)) / parseFloat(supervisorTotal)) * 100).toFixed(2)}%
            </Text>
          )}
          <Button title="common.submit" onPress={handleSubmit} loading={isSubmitting} icon={<Save size={18} color="white" />} />
        </Card>
      </ScrollView>
    </View>
  )
}
