import React from 'react'
import { View, Text } from 'react-native'

interface ScoreBarProps {
  label: string
  score: number
  maxScore?: number
  color?: string
}

export function ScoreBar({ label, score, maxScore = 100, color = '#E65C00' }: ScoreBarProps) {
  const percentage = Math.min((score / maxScore) * 100, 100)

  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-gray-700">{label}</Text>
        <Text className="text-sm font-bold text-gray-900">{score.toFixed(1)}</Text>
      </View>
      <View className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </View>
    </View>
  )
}
