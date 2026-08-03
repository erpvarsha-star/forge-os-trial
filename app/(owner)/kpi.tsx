import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { BarChart } from 'react-native-chart-kit'
import { Dimensions } from 'react-native'

export default function OwnerKPI() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />

  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{ data: [85, 88, 82, 90, 87, 92] }],
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('owner.kpiDashboard')}</Text>
        <Card className="mb-4">
          <BarChart
            data={data}
            width={Dimensions.get('window').width - 48}
            height={220}
            yAxisLabel="%"
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(230, 92, 0, ${opacity})`,
              labelColor: () => '#6B7280',
            }}
            style={{ borderRadius: 8 }}
          />
        </Card>
      </ScrollView>
    </View>
  )
}
