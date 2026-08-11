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
    <Card variant="flat" className="bg-status-late-bg border-amber-200">
      <View className="flex-row items-start gap-3">
        <View className="w-8 h-8 rounded-full bg-white items-center justify-center mt-0.5">
          {/* lucide icons don't pick up NativeWind className here — pass
              color explicitly, matching how every other icon in this app
              is colored. */}
          <AlertTriangle size={18} color="#A6650A" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-status-late mb-1">{t('worker.safetyTip')}</Text>
          <Text className="text-sm text-ink-800 leading-relaxed">
            {isHindi ? tip.hi : tip.en}
          </Text>
          {isHindi && (
            <Text className="text-xs text-ink-500 mt-1 italic">{tip.en}</Text>
          )}
        </View>
      </View>
    </Card>
  )
}
