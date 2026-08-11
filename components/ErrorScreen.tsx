import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { AlertCircle } from 'lucide-react-native'
import { STATUS } from './theme'

interface ErrorScreenProps {
  message?: string
  onRetry?: () => void
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <View className="w-16 h-16 rounded-full bg-status-rejected-bg items-center justify-center mb-4">
        <AlertCircle size={28} color={STATUS.rejected.fg} />
      </View>
      <Text className="text-lg font-bold text-ink-900 mb-2 text-center">{t('common.error')}</Text>
      <Text className="text-sm text-ink-500 text-center mb-6 leading-5">{message || t('common.noData')}</Text>
      {onRetry && <Button title="common.tryAgain" onPress={onRetry} variant="outline" />}
    </View>
  )
}
