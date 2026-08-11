import React from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import Constants from 'expo-constants'
import { Download } from 'lucide-react-native'

// Permanent link — GitHub Releases' "latest" alias always resolves to the
// most recent build published by .github/workflows/build-apk.yml.
const APK_DOWNLOAD_URL =
  'https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk'

export function UpdateAppLink() {
  const { t } = useTranslation()
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
      className="bg-white rounded-xl p-4 mb-2 flex-row items-center justify-between shadow-sm border border-gray-100"
    >
      <View className="flex-row items-center gap-3">
        <Download size={20} color="#E65C00" />
        <Text className="text-base text-gray-900">{t('common.updateApp')}</Text>
      </View>
      <Text className="text-sm text-gray-500">v{Constants.expoConfig?.version}</Text>
    </TouchableOpacity>
  )
}
