import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/lib/config'

export function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <View className="w-16 h-16 bg-orange-600 rounded-2xl items-center justify-center mb-4">
        <Text className="text-white font-bold text-2xl">F</Text>
      </View>
      <Text className="text-lg font-bold text-gray-900 mb-2">{APP_CONFIG.appName}</Text>
      <ActivityIndicator color="#E65C00" />
      <Text className="text-sm text-gray-500 mt-2">{t('common.loading')}</Text>
    </View>
  )
}
