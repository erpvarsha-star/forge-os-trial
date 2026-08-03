import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SAFETY_TIPS } from '@/constants'
import { Card } from './Card'
import { AlertTriangle } from 'lucide-react-native'

interface SafetyTipProps {
  dayIndex?: number
}

export function SafetyTip({ dayIndex }: SafetyTipProps) {
  const { t, i18n } = useTranslation()
  const index = dayIndex !== undefined ? dayIndex % SAFETY_TIPS.length : new Date().getDay() % SAFETY_TIPS.length
  const tip = SAFETY_TIPS[index]
  const isHindi = i18n.language === 'hi'

  return (
    <Card className="bg-amber-50 border-amber-200">
      <View className="flex-row items-start gap-3">
        <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
        <View className="flex-1">
          <Text className="text-sm font-bold text-amber-800 mb-1">{t('worker.safetyTip')}</Text>
          <Text className="text-sm text-amber-900 leading-relaxed">
            {isHindi ? tip.hi : tip.en}
          </Text>
          {isHindi && (
            <Text className="text-xs text-amber-700 mt-1 italic">{tip.en}</Text>
          )}
        </View>
      </View>
    </Card>
  )
}
