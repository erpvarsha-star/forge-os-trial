import React from 'react'
import { View, Text } from 'react-native'

interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  headerAction?: React.ReactNode
  /**
   * Visual weight. Defaults to 'default' (bordered surface + resting
   * shadow), matching the previous unconditional look exactly so existing
   * call sites are unaffected. 'flat' drops the shadow (for cards stacked
   * directly on other cards / tinted sections, where a shadow reads as
   * noise). 'outlined' drops the shadow but keeps a slightly stronger
   * border, for a lower-emphasis alternative to 'default'.
   */
  variant?: 'default' | 'flat' | 'outlined'
}

export function Card({ children, title, className = '', headerAction, variant = 'default' }: CardProps) {
  const variantStyles = {
    default: 'border border-ink-100 shadow-card',
    flat: 'border border-ink-100',
    outlined: 'border border-ink-200',
  }

  return (
    <View className={`bg-white rounded-card p-4 ${variantStyles[variant]} ${className}`}>
      {(title || headerAction) && (
        <View className="flex-row items-center justify-between mb-3">
          {title && <Text className="text-base font-bold text-ink-900 tracking-tight flex-1 pr-2">{title}</Text>}
          {headerAction}
        </View>
      )}
      {children}
    </View>
  )
}
