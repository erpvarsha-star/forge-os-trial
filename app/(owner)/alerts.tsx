import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { FraudAlert } from '@/types'
import { AlertTriangle, MapPin, Users, Zap } from 'lucide-react-native'

export default function OwnerAlerts() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      if (!employee) return
      const { data } = await supabase.from('fraud_alerts').select('*').eq('status', 'open').order('created_at', { ascending: false })
      if (data) setAlerts(data as FraudAlert[])
      setIsLoading(false)
    }
    fetch()
  }, [employee])

  const getIcon = (type: string) => {
    switch (type) {
      case 'mock_location': return <MapPin size={20} className="text-red-600" />
      case 'buddy_punching': return <Users size={20} className="text-red-600" />
      case 'bulk_confirm': return <Zap size={20} className="text-red-600" />
      default: return <AlertTriangle size={20} className="text-red-600" />
    }
  }

  if (!employee) return <LoadingScreen />
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Text className="text-xl font-bold text-gray-900 mb-4">{t('owner.fraudAlerts')}</Text>
        {alerts.map(alert => (
          <Card key={alert.id} className="mb-2 bg-red-50 border-red-200">
            <View className="flex-row items-start gap-3">
              {getIcon(alert.type)}
              <View className="flex-1">
                <Text className="text-sm font-bold text-red-800">{t(`owner.${alert.type}`)}</Text>
                <Text className="text-xs text-red-700 mt-1">{alert.description}</Text>
                <Text className="text-xs text-red-600 mt-1 capitalize">Severity: {alert.severity}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  )
}
