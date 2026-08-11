import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/lib/config'
import { BrandLogo } from '@/components/BrandLogo'
// Side-effect import — see the comment in theme.ts for why this is here
// instead of the app's root layout.
import './theme'

interface HeaderProps {
  empCode?: string
  role?: string
  plantName?: string
}

export function Header({ empCode, role, plantName }: HeaderProps) {
  const { t } = useTranslation()

  return (
    <View className="bg-white border-b border-ink-100 px-4 py-3 shadow-card">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 pr-3">
          <BrandLogo size="sm" style={{ width: 40, height: 40 }} />
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900 tracking-tight" numberOfLines={1}>
              {APP_CONFIG.companyName}
            </Text>
            <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={1}>
              {plantName || t('common.plantName')}
            </Text>
          </View>
        </View>
        <View className="items-end">
          {empCode && (
            <Text className="text-2xs font-mono font-semibold text-ink-600 bg-ink-100 rounded px-1.5 py-0.5">
              {empCode}
            </Text>
          )}
          {role && (
            <Text
              className="text-2xs font-bold text-brand-700 bg-brand-50 rounded-full px-2 py-0.5 mt-1 capitalize"
              numberOfLines={1}
            >
              {role.replace(/_/g, ' ')}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
