import React from 'react'
import { View, Text, Image } from 'react-native'
import { useTranslation } from 'react-i18next'
import { APP_CONFIG } from '@/lib/config'

interface HeaderProps {
  empCode?: string
  role?: string
  plantName?: string
}

export function Header({ empCode, role, plantName }: HeaderProps) {
  const { t } = useTranslation()

  return (
    <View className="bg-white border-b border-gray-200 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {APP_CONFIG.logoUrl ? (
            <Image source={{ uri: APP_CONFIG.logoUrl }} className="w-10 h-10 rounded-lg" resizeMode="contain" />
          ) : (
            <View className="w-10 h-10 bg-orange-600 rounded-lg items-center justify-center">
              <Text className="text-white font-bold text-lg">F</Text>
            </View>
          )}
          <View>
            <Text className="text-sm font-bold text-gray-900">{APP_CONFIG.companyName}</Text>
            <Text className="text-xs text-gray-500">{plantName || t('common.plantName')}</Text>
          </View>
        </View>
        <View className="items-end">
          {empCode && <Text className="text-xs font-mono text-gray-600">{empCode}</Text>}
          {role && <Text className="text-xs text-orange-600 capitalize">{role}</Text>}
        </View>
      </View>
    </View>
  )
}
