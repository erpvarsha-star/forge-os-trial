import React from 'react'
import { View, Text } from 'react-native'
import { Inbox } from 'lucide-react-native'
import './theme'

interface EmptyStateProps {
  /** Already-translated text — EmptyState does not call t() itself. */
  title: string
  message?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/**
 * Placeholder for empty lists ("no leave requests", "no notifications",
 * etc.) — replaces the bare "No data" text scattered around several
 * screens with a consistent, less bleak empty state.
 */
export function EmptyState({ title, message, icon, action, className = '' }: EmptyStateProps) {
  return (
    <View className={`items-center justify-center py-10 px-6 ${className}`}>
      <View className="w-14 h-14 rounded-full bg-ink-100 items-center justify-center mb-3">
        {icon || <Inbox size={24} color="#8B93A3" />}
      </View>
      <Text className="text-sm font-bold text-ink-700 text-center mb-1">{title}</Text>
      {message && <Text className="text-xs text-ink-500 text-center leading-5">{message}</Text>}
      {action && <View className="mt-4">{action}</View>}
    </View>
  )
}
