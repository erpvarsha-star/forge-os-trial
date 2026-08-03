import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { FileText } from 'lucide-react-native'

export default function ManagerReports() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('common.reports')}</Text>
        <Card className="mb-2"><View className="flex-row items-center gap-3"><FileText size={20} className="text-orange-600" /><Text className="text-sm text-gray-700">Department Attendance Report</Text></View></Card>
        <Card className="mb-2"><View className="flex-row items-center gap-3"><FileText size={20} className="text-orange-600" /><Text className="text-sm text-gray-700">Production Summary</Text></View></Card>
        <Card className="mb-2"><View className="flex-row items-center gap-3"><FileText size={20} className="text-orange-600" /><Text className="text-sm text-gray-700">Score Distribution</Text></View></Card>
      </ScrollView>
    </View>
  )
}
