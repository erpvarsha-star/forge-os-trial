import React from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/lib/config'
import { BrandLogo } from '@/components/BrandLogo'
import { BRAND } from './theme'

export function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <BrandLogo size="md" />
      <Text className="text-base font-bold text-ink-900 mt-5 mb-4 tracking-tight">{APP_CONFIG.appName}</Text>
      <ActivityIndicator color={BRAND[600]} />
      <Text className="text-sm text-ink-500 mt-3">{t('common.loading')}</Text>
    </View>
  )
}
