import React, { useState } from 'react'
import { View, Text, ScrollView, Alert, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { LoadingScreen } from '@/components/LoadingScreen'
import { UpdateAppLink } from '@/components/UpdateAppLink'
import { removePushToken } from '@/lib/notifications'
import { router } from 'expo-router'
import {
  FileText, User, Bell, Globe, LogOut, ChevronRight, Wallet, QrCode
} from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'

export default function WorkerMore() {
  const { t } = useTranslation()
  const { employee, logout } = useAuth()
  const { language, toggleLanguage } = useLanguage(employee)
  const [showLangModal, setShowLangModal] = useState(false)

  if (!employee) return <LoadingScreen />

  const handleLogout = async () => {
    if (employee) await removePushToken(employee.id)
    await logout()
  }

  const menuItems = [
    { icon: <FileText size={20} color="#E65C00" />, label: 'common.payslip', onPress: () => router.push('/(worker)/payslip') },
    { icon: <User size={20} color="#E65C00" />, label: 'common.profile', onPress: () => router.push('/(worker)/profile') },
    { icon: <Bell size={20} color="#E65C00" />, label: 'common.notifications', onPress: () => router.push('/(worker)/notifications') },
    { icon: <Wallet size={20} color="#E65C00" />, label: 'common.advance', onPress: () => router.push('/(worker)/advance') },
    { icon: <QrCode size={20} color="#E65C00" />, label: 'worker.qrCheckIn', onPress: () => router.push('/(worker)/qr') },
    { icon: <Globe size={20} color="#E65C00" />, label: 'common.language', onPress: () => setShowLangModal(true), value: language === 'hi' ? 'हिंदी' : 'English' },
  ]

  return (
    <View className="flex-1 bg-gray-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4">
        <Card className="mb-4">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center">
              <User size={28} color="#E65C00" />
            </View>
            <View>
              <Text className="text-lg font-bold text-gray-900">{employee.name}</Text>
              <Text className="text-sm text-gray-500">{employee.emp_code}</Text>
              <Text className="text-sm text-orange-600 capitalize">{employee.role}</Text>
            </View>
          </View>
        </Card>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between shadow-sm border border-gray-100"
          >
            <View className="flex-row items-center gap-3">
              {item.icon}
              <Text className="text-base text-gray-900">{t(item.label)}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              {item.value && <Text className="text-sm text-gray-500">{item.value}</Text>}
              <ChevronRight size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        ))}

        <UpdateAppLink />

        <Button
          title="common.logout"
          onPress={handleLogout}
          variant="danger"
          size="lg"
          className="mt-4"
          icon={<LogOut size={20} color="white" />}
        />
      </ScrollView>

      <Modal visible={showLangModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-lg font-bold text-gray-900 mb-4">{t('common.language')}</Text>
            <TouchableOpacity
              onPress={() => { toggleLanguage(); setShowLangModal(false); }}
              className="p-4 rounded-lg bg-gray-50 mb-2"
            >
              <Text className="text-base text-gray-900">{language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}</Text>
            </TouchableOpacity>
            <Button title="common.close" onPress={() => setShowLangModal(false)} variant="ghost" />
          </View>
        </View>
      </Modal>
    </View>
  )
}
