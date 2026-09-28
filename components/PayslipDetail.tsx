import React from 'react'
import { View, Text, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { Download, FileText } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { usePayslip } from '@/hooks/usePayslips'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { generatePayslip } from '@/lib/payslip'
import { istMonthYear } from '@/lib/istDate'

const num = (v: number | null | undefined) => Number(v ?? 0)
const row = (label: string, value: number | null | undefined): [string, number | null | undefined] => [label, value]

// Line items that only apply to one employee category (Staff allowances,
// Worker allowances) are rendered only when the record actually has a
// non-zero value — a consultant or worker row simply won't show the Staff
// allowance rows, rather than a wall of zeros. Real HR sheets, imported
// 28 Sep 2026 (PATCH_54/56) — see CLAUDE.md "Real payroll data on file".
export function PayslipDetail() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const params = useLocalSearchParams<{ month?: string; year?: string }>()
  const current = istMonthYear()
  const month = params.month ?? current.month
  const year = params.year ? Number(params.year) : current.year
  const { record, isLoading } = usePayslip(employee?.id, month, year)

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

  const baseEarningsRows = record ? [
    row(t('worker.basic'), record.basic),
    row(t('worker.hra'), record.hra),
    row(t('worker.conveyance'), record.conveyance),
    row(t('worker.special'), record.special_allowance),
    row(t('worker.overtime'), record.overtime),
  ] : []

  const extraEarningsRows = record ? [
    row(t('worker.payslipEducation'), record.education),
    row(t('worker.payslipMedical'), record.medical),
    row(t('worker.payslipProfessionalDevelopment'), record.professional_development),
    row(t('worker.payslipCommunication'), record.communication),
    row(t('worker.payslipUniform'), record.uniform),
    row(t('worker.payslipWashing'), record.washing),
    row(t('worker.payslipHeatAllowance'), record.heat_allowance),
    row(t('worker.payslipVda'), record.vda),
    row(t('worker.payslipProductionAllowance'), record.production_allowance),
    row(t('worker.payslipArrears'), record.arrears),
    row(t('worker.payslipDispatchIncentive'), record.dispatch_incentive),
    row(t('worker.payslipOtherAllowance'), record.other_allowance),
    row(t('worker.payslipLeaveEncashment'), record.leave_encashment),
  ].filter(([, v]) => num(v) !== 0) : []

  const earningsRows = [...baseEarningsRows, ...extraEarningsRows]

  const earningsTotal = earningsRows.reduce((sum, [, v]) => sum + num(v), 0)

  const deductionRows = record ? [
    row(t('worker.pf'), record.pf),
    row(t('worker.esic'), record.esic),
    row(t('worker.pt'), record.pt),
    row(t('worker.advanceRecovery'), record.advance_recovery),
    row(t('worker.tds'), record.tds),
    row(t('worker.payslipCanteen'), record.canteen),
    row(t('worker.payslipSociety'), record.society),
    row(t('worker.payslipMlwf'), record.mlwf),
    row(t('worker.payslipOtherDeduction'), record.other_deduction),
  ].filter(([, v]) => num(v) !== 0) : []

  const deductionTotal = deductionRows.reduce((sum, [, v]) => sum + num(v), 0)

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-ink-900 mb-4">
          {record ? t('worker.payslipMonth', { month: record.month }) : t('worker.payslipTitle')}
        </Text>

        {record ? (
          <>
            <Card className="mb-4">
              <View className="items-center py-4">
                <Text className="text-3xl font-bold text-brand-600">₹{num(record.net_pay).toFixed(2)}</Text>
                <Text className="text-sm text-ink-500">{t('worker.netPay')}</Text>
              </View>
              {(record.present_days !== undefined || record.working_days !== undefined) && (
                <View className="flex-row justify-center gap-4 pb-3">
                  <Text className="text-xs text-ink-500">
                    {t('worker.payslipPresentDays')}: {num(record.present_days)} / {num(record.working_days)}
                  </Text>
                </View>
              )}
            </Card>

            <Card title={t('worker.earnings')} className="mb-4">
              <View className="gap-2">
                {earningsRows.map(([label, value]) => (
                  <Row key={label} label={label} value={num(value)} />
                ))}
                <View className="border-t border-ink-200 pt-2 mt-2">
                  <Row label={t('common.total')} value={earningsTotal} isTotal />
                </View>
              </View>
            </Card>

            <Card title={t('worker.deductions')} className="mb-4">
              <View className="gap-2">
                {deductionRows.length > 0 ? deductionRows.map(([label, value]) => (
                  <Row key={label} label={label} value={num(value)} />
                )) : (
                  <Text className="text-sm text-ink-400">{t('worker.payslipNoDeductions')}</Text>
                )}
                <View className="border-t border-ink-200 pt-2 mt-2">
                  <Row label={t('common.total')} value={deductionTotal} isTotal />
                </View>
              </View>
            </Card>

            {num(record.production_incentive) > 0 && (
              <Card className="mb-4">
                <Row label={t('worker.productionIncentive')} value={num(record.production_incentive)} isTotal />
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
            <Text className="text-sm text-ink-500 mt-3 text-center px-4">
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
      <Text className={`text-sm ${isTotal ? 'font-bold text-ink-900' : 'text-ink-600'}`}>{label}</Text>
      <Text className={`text-sm ${isTotal ? 'font-bold text-ink-900' : 'text-ink-900'}`}>₹{value.toFixed(2)}</Text>
    </View>
  )
}
