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
import { buildSlipView, formatInr, monthLabel, type LabelDef } from '@/lib/payslipLayout'


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
      Alert.alert(t('common.error'), t('worker.payslipPdfFailed'))
    }
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const view = record
    ? buildSlipView(record, { name: employee.name, empCode: employee.emp_code, department: employee.department })
    : null
  const lbl = (l: LabelDef) => t(l.key, { defaultValue: l.en, ...(l.vars ?? {}) })

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-ink-900 mb-4">
          {record ? t('worker.payslipMonth', { month: monthLabel(record.month, record.year) }) : t('worker.payslipTitle')}
        </Text>

        {record && view ? (
          <>
            <Card className="mb-4">
              <View className="gap-1 pb-2">
                <Row label={t('worker.payslipEmpId')} text={view.empCode} />
                <Row label={t('common.name', { defaultValue: 'Name' })} text={view.name} />
                {view.department ? <Row label={t('worker.payslipDepartment')} text={view.department} /> : null}
                {view.designation ? <Row label={t('worker.payslipDesignation')} text={view.designation} /> : null}
                {view.doj ? <Row label={t('worker.payslipDoj')} text={view.doj} /> : null}
              </View>
              <View className="items-center py-3 border-t border-ink-100">
                <Text className="text-3xl font-bold text-brand-600">₹{formatInr(view.netPay)}</Text>
                <Text className="text-sm text-ink-500">{t('worker.netPay')}</Text>
                <Text className="text-xs text-ink-500 mt-1 text-center">{t('worker.payslipNetInWords')}: {view.netInWords}</Text>
              </View>
            </Card>

            {view.attendance.length > 0 && (
              <Card className="mb-4">
                <View className="flex-row flex-wrap gap-y-2">
                  {view.attendance.map((c) => (
                    <View key={c.label.key + c.label.en} className="w-1/4 items-center px-1">
                      <Text className="text-[11px] text-ink-500 text-center">{lbl(c.label)}</Text>
                      <Text className={`text-sm ${c.strong ? 'font-bold' : ''} text-ink-900`}>{c.value}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            <Card title={t('worker.earnings')} className="mb-4">
              <View className="gap-2">
                {view.earnings.map((r) => (
                  <Row key={r.key} label={lbl(r.label)} value={r.amount}
                    sub={r.rate ? t('worker.payslipOtHours', { h: r.rate }) : undefined} />
                ))}
                <View className="border-t border-ink-200 pt-2 mt-2">
                  <Row label={t('worker.payslipGross')} value={view.totalEarnings} isTotal />
                </View>
              </View>
            </Card>

            <Card title={t('worker.deductions')} className="mb-4">
              <View className="gap-2">
                {view.deductions.length > 0 ? view.deductions.map((r) => (
                  <Row key={r.key} label={lbl(r.label)} value={r.amount} />
                )) : (
                  <Text className="text-sm text-ink-400">{t('worker.payslipNoDeductions')}</Text>
                )}
                <View className="border-t border-ink-200 pt-2 mt-2">
                  <Row label={t('worker.payslipTotalDeductions')} value={view.totalDeductions} isTotal />
                </View>
              </View>
            </Card>

            {view.adjustment !== 0 && (
              <Card className="mb-4">
                <Row label={t('worker.payslipAdjustment')} value={view.adjustment} />
              </Card>
            )}

            {(view.idCells.length > 0 || view.leaveCells.length > 0) && (
              <Card className="mb-4">
                <View className="gap-1">
                  {[...view.idCells, ...view.leaveCells].map((c) => (
                    <Row key={c.label.key} label={lbl(c.label)} text={c.value} />
                  ))}
                </View>
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

function Row({ label, value, text, sub, isTotal = false }: {
  label: string; value?: number; text?: string; sub?: string; isTotal?: boolean
}) {
  return (
    <View className="flex-row justify-between">
      <Text className={`text-sm flex-1 pr-2 ${isTotal ? 'font-bold text-ink-900' : 'text-ink-600'}`}>
        {label}{sub ? `  (${sub})` : ''}
      </Text>
      <Text className={`text-sm ${isTotal ? 'font-bold text-ink-900' : 'text-ink-900'}`}>
        {text !== undefined ? text : `₹${formatInr(value)}`}
      </Text>
    </View>
  )
}
