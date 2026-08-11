import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { UpdateAppLink } from '@/components/UpdateAppLink'
import { removePushToken } from '@/lib/notifications'
import { LogOut, Globe, Briefcase } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'

export default function ManagerMore() {
  const { t } = useTranslation()
  const { employee, logout } = useAuth()
  const { language, toggleLanguage } = useLanguage(employee)
  if (!employee) return <LoadingScreen />
  const handleLogout = async () => { if (employee) await removePushToken(employee.id); await logout() }
  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Card className="mb-4">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center"><Briefcase size={28} color="#E65C00" /></View>
            <View><Text className="text-lg font-bold text-gray-900">{employee.name}</Text><Text className="text-sm text-orange-600 capitalize">{employee.role}</Text></View>
          </View>
        </Card>
        <TouchableOpacity onPress={toggleLanguage} className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between shadow-sm border border-gray-100">
          <View className="flex-row items-center gap-3"><Globe size={20} color="#E65C00" /><Text className="text-base text-gray-900">{t('common.language')}</Text></View>
          <Text className="text-sm text-gray-500">{language === 'hi' ? 'हिंदी' : 'English'}</Text>
        </TouchableOpacity>
        <UpdateAppLink />
        <Button title="common.logout" onPress={handleLogout} variant="danger" size="lg" className="mt-4" icon={<LogOut size={20} color="white" />} />
      </ScrollView>
    </View>
  )
}
