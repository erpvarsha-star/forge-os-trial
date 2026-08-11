import React from 'react'
import { View, Text } from 'react-native'
import { BRAND } from './theme'

interface ScoreBarProps {
  label: string
  score: number
  maxScore?: number
  color?: string
}

export function ScoreBar({ label, score, maxScore = 100, color = BRAND[600] }: ScoreBarProps) {
  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100)

  return (
    <View className="mb-3.5">
      <View className="flex-row justify-between items-baseline mb-1.5">
        <Text className="text-sm text-ink-600 flex-1 pr-2">{label}</Text>
        <Text className="text-sm font-bold text-ink-900">{score.toFixed(1)}</Text>
      </View>
      <View className="h-2.5 bg-ink-100 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </View>
    </View>
  )
}
