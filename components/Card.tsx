import React from 'react'
import { View, Text } from 'react-native'

interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  headerAction?: React.ReactNode
}

export function Card({ children, title, className = '', headerAction }: CardProps) {
  return (
    <View className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${className}`}>
      {(title || headerAction) && (
        <View className="flex-row items-center justify-between mb-3">
          {title && <Text className="text-lg font-bold text-gray-900">{title}</Text>}
          {headerAction}
        </View>
      )}
      {children}
    </View>
  )
}
