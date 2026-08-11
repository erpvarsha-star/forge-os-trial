import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BarChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'
import { Info } from 'lucide-react-native'
import { INK } from '@/components/theme'

export default function OwnerKPI() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />

  // Hardcoded — not wired to the DB yet (known gap, see CLAUDE.md). Labelled
  // as sample data below rather than presented as a live figure.
  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{ data: [85, 88, 82, 90, 87, 92] }],
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.kpiDashboard')}</Text>
        </View>

        <Card className="mb-3">
          <BarChart
            data={data}
            width={Dimensions.get('window').width - 64}
            height={220}
            yAxisLabel="%"
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(230, 92, 0, ${opacity})`,
              labelColor: () => INK[500],
            }}
            style={{ borderRadius: 8 }}
          />
        </Card>
        <View className="flex-row items-start gap-1.5 px-1">
          <Info size={13} color={INK[400]} style={{ marginTop: 1 }} />
          <Text className="text-xs text-ink-400 flex-1">{t('owner.kpiDataNote')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}
