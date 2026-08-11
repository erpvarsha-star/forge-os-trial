import React from 'react'
import { View, Text } from 'react-native'
import { Card } from './Card'
import { BRAND, INK } from './theme'

interface StatTileProps {
  /** Already-translated label — StatTile does not call t() itself. */
  label: string
  /** Pre-formatted display value, e.g. "94.2%", "₹12,400", "37". */
  value: string
  icon?: React.ReactNode
  /** Small supporting line under the value, e.g. "vs 91% last month". */
  helperText?: string
  tone?: 'brand' | 'neutral'
  className?: string
}

/**
 * Compact KPI tile for dashboards (owner/plant-head/manager summary rows).
 * Not currently wired into any screen — a building block for dashboard work
 * elsewhere in the app.
 */
export function StatTile({ label, value, icon, helperText, tone = 'neutral', className = '' }: StatTileProps) {
  const iconBg = tone === 'brand' ? BRAND[50] : INK[100]

  return (
    <Card variant="default" className={`flex-1 ${className}`}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide flex-1 pr-2" numberOfLines={2}>
          {label}
        </Text>
        {icon && (
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: iconBg }}>
            {icon}
          </View>
        )}
      </View>
      <Text className="text-2xl font-bold text-ink-900 tracking-tight" numberOfLines={1}>
        {value}
      </Text>
      {helperText && <Text className="text-xs text-ink-500 mt-1">{helperText}</Text>}
    </Card>
  )
}
