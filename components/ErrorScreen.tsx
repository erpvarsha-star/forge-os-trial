import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { AlertCircle } from 'lucide-react-native'

interface ErrorScreenProps {
  message?: string
  onRetry?: () => void
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <Text className="text-lg font-bold text-gray-900 mb-2">{t('common.error')}</Text>
      <Text className="text-sm text-gray-500 text-center mb-6">{message || t('common.noData')}</Text>
      {onRetry && <Button title="common.tryAgain" onPress={onRetry} variant="outline" />}
    </View>
  )
}
