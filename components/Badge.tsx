import React from 'react'
import { View, Text } from 'react-native'
import { STATUS, StatusTokenKey } from './theme'

interface BadgeProps {
  /** Already-translated display text — Badge does not call t() itself. */
  label: string
  /** 'neutral'/'brand' are generic tones; the rest map to the semantic
   * attendance/approval status tokens in tailwind.config.js. */
  tone?: 'neutral' | 'brand' | StatusTokenKey
  size?: 'sm' | 'md'
  className?: string
}

const NEUTRAL = { fg: '#4B5265', bg: '#ECEEF2' }
const BRAND_TONE = { fg: '#BA4A02', bg: '#FFE4CC' }

/**
 * Small status/role pill — for attendance codes (P/A/L/WO/H/HL), approval
 * states (pending/approved/rejected), or any other short label that needs
 * to stand out from body text without shouting. Colors come from the same
 * `status` tokens AttendanceCalendar and other components use, so a
 * "Pending" badge here always matches a "Pending" dot elsewhere.
 */
export function Badge({ label, tone = 'neutral', size = 'md', className = '' }: BadgeProps) {
  const colors = tone === 'neutral' ? NEUTRAL : tone === 'brand' ? BRAND_TONE : STATUS[tone]
  const sizeStyles = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const textSize = size === 'sm' ? 'text-2xs' : 'text-xs'

  return (
    <View
      className={`self-start rounded-full ${sizeStyles} ${className}`}
      style={{ backgroundColor: colors.bg }}
    >
      <Text className={`${textSize} font-bold`} style={{ color: colors.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}
