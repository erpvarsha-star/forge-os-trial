import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { CheckCircle2, Clock, ChevronRight, FileText } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { usePayslips } from '@/hooks/usePayslips'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'

// FY2026-27 only, per Yash's explicit instruction (28 Sep 2026) — the real
// salary sheets carry history back to 2022 but payslips start from April
// 2026 for this financial year, nothing earlier.
export function PayslipsList({ routePrefix }: { routePrefix: string }) {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const { months, isLoading } = usePayslips(employee?.id)

  if (!employee) return <LoadingScreen />

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-ink-900 mb-1">{t('worker.payslipsTitle')}</Text>
        <Text className="text-sm text-ink-500 mb-4">{t('worker.payslipsSubtitle')}</Text>

        {isLoading ? (
          <LoadingScreen />
        ) : (
          <View className="bg-white rounded-xl shadow-sm border border-ink-100 overflow-hidden">
            {months.map((m, index) => (
              <TouchableOpacity
                key={`${m.year}-${m.month}`}
                disabled={!m.issued}
                onPress={() => router.push(`${routePrefix}/payslip?month=${m.month}&year=${m.year}`)}
                className={`p-4 flex-row items-center justify-between ${
                  index < months.length - 1 ? 'border-b border-ink-100' : ''
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1">
                  {m.issued ? <CheckCircle2 size={20} color="#16A34A" /> : <Clock size={20} color="#9CA3AF" />}
                  <Text className={`text-base flex-1 ${m.issued ? 'text-ink-900' : 'text-ink-400'}`}>
                    {m.label}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {m.issued ? (
                    <>
                      <Text className="text-sm font-semibold text-ink-700">
                        ₹{Number(m.record?.net_pay ?? 0).toFixed(0)}
                      </Text>
                      <ChevronRight size={18} color="#9CA3AF" />
                    </>
                  ) : (
                    <Text className="text-xs text-ink-400">{t('worker.notYetIssued')}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isLoading && months.every(m => !m.issued) && (
          <Card className="items-center py-14 mt-4">
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
