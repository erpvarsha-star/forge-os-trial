import React from 'react'
import { View, Text } from 'react-native'
import './theme'

interface SectionProps {
  /** Already-translated text — Section does not call t() itself. */
  title?: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Lightweight grouping wrapper for dashboard/list screens — a section
 * heading plus consistent vertical rhythm, with none of Card's border or
 * shadow. Use this to group several Cards under one heading; use Card
 * itself for the individual bordered surfaces within it.
 */
export function Section({ title, subtitle, right, children, className = '' }: SectionProps) {
  return (
    <View className={`mb-6 ${className}`}>
      {(title || right) && (
        <View className="flex-row items-end justify-between mb-3">
          <View className="flex-1 pr-2">
            {title && <Text className="text-sm font-bold text-ink-900 uppercase tracking-wide">{title}</Text>}
            {subtitle && <Text className="text-xs text-ink-500 mt-0.5">{subtitle}</Text>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  )
}
