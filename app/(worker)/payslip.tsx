import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { PayrollRecord } from '@/types'
import { generatePayslip } from '@/lib/payslip'
import * as Sharing from 'expo-sharing'
import { Download, FileText } from 'lucide-react-native'

export default function PayslipScreen() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [record, setRecord] = useState<PayrollRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPayslip()
  }, [employee])

  const fetchPayslip = async () => {
    if (!employee) return
    const now = new Date()
    const { data } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', String(now.getMonth() + 1).padStart(2, '0'))
      .eq('year', now.getFullYear())
      .single()
    setRecord(data as PayrollRecord)
    setIsLoading(false)
  }

  const generatePDF = async () => {
    if (!record || !employee) return
    try {
      const uri = await generatePayslip(employee, record)
      await Sharing.shareAsync(uri)
    } catch (e) {
      Alert.alert(t('common.error'), 'Failed to generate PDF')
    }
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">
          {record ? t('worker.payslipMonth', { month: record.month }) : t('worker.payslipTitle')}
        </Text>

        {record ? (
          <>
            <Card className="mb-4">
              <View className="items-center py-4">
                <Text className="text-3xl font-bold text-orange-600">₹{record.net_pay.toFixed(2)}</Text>
                <Text className="text-sm text-gray-500">{t('worker.netPay')}</Text>
              </View>
            </Card>

            <Card title={t('worker.earnings')} className="mb-4">
              <View className="gap-2">
                <Row label={t('worker.basic')} value={record.basic} />
                <Row label={t('worker.hra')} value={record.hra} />
                <Row label={t('worker.conveyance')} value={record.conveyance} />
                <Row label={t('worker.special')} value={record.special_allowance} />
                <Row label={t('worker.overtime')} value={record.overtime} />
                <View className="border-t border-gray-200 pt-2 mt-2">
                  <Row label={t('common.total')} value={record.basic + record.hra + record.conveyance + record.special_allowance + record.overtime} isTotal />
                </View>
              </View>
            </Card>

            <Card title={t('worker.deductions')} className="mb-4">
              <View className="gap-2">
                <Row label={t('worker.pf')} value={record.pf} />
                <Row label={t('worker.esic')} value={record.esic} />
                <Row label={t('worker.pt')} value={record.pt} />
                <Row label={t('worker.advanceRecovery')} value={record.advance_recovery} />
                <Row label={t('worker.tds')} value={record.tds} />
                <View className="border-t border-gray-200 pt-2 mt-2">
                  <Row label={t('common.total')} value={record.pf + record.esic + record.pt + record.advance_recovery + record.tds} isTotal />
                </View>
              </View>
            </Card>

            {record.production_incentive !== undefined && record.production_incentive > 0 && (
              <Card className="mb-4">
                <Row label={t('worker.productionIncentive')} value={record.production_incentive} isTotal />
              </Card>
            )}

            <Button
              title="worker.downloadPdf"
              onPress={generatePDF}
              variant="outline"
              icon={<Download size={18} color="#E65C00" />}
            />
          </>
        ) : (
          <Card className="items-center py-14">
            <FileText size={40} color="#D1D5DB" />
            <Text className="text-sm text-gray-500 mt-3 text-center px-4">
              {t('worker.payslipNotAvailable')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  )
}

function Row({ label, value, isTotal = false }: { label: string; value: number; isTotal?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm ${isTotal ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</Text>
      <Text className={`text-sm ${isTotal ? 'font-bold text-gray-900' : 'text-gray-900'}`}>₹{value.toFixed(2)}</Text>
    </View>
  )
}
