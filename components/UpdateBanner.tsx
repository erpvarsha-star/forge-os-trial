import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Download, X } from 'lucide-react-native'
import { useAppVersion } from '@/hooks/useAppVersion'

const APK_DOWNLOAD_URL =
  'https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk'

const DISMISSED_BUILD_KEY = 'updateBanner.dismissedBuild'

/**
 * "Update available" banner.
 *
 * Deliberately NOT a push notification: Expo Push requires an EAS projectId,
 * which this project has none of (app.json has no extra.eas.projectId), so
 * push token registration always fails and no push of any kind can be
 * delivered. This needs no Expo account and works today.
 *
 * Build numbers come from the GitHub release tag (`apk-<run number>`), which
 * CI increments on every successful build. app.json's `version` ("1.0.0") is
 * hand-maintained and does not move per build, so it cannot be used for the
 * comparison — the installed build number is read from Android's versionCode
 * via Constants instead.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const { latestBuild, isUpdateAvailable } = useAppVersion()
  const [dismissedBuild, setDismissedBuild] = useState<number | null>(null)
  const [dismissLoaded, setDismissLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(DISMISSED_BUILD_KEY)
      .then(v => {
        if (cancelled) return
        setDismissedBuild(v ? Number(v) : null)
        setDismissLoaded(true)
      })
      .catch(() => { if (!cancelled) setDismissLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // Dismissal is per-build: hiding the banner for build 22 must not also hide
  // it when build 23 ships.
  const isDismissed = dismissedBuild !== null && latestBuild !== null && dismissedBuild >= latestBuild

  if (!dismissLoaded || !isUpdateAvailable || isDismissed || latestBuild === null) return null

  const dismiss = async () => {
    await AsyncStorage.setItem(DISMISSED_BUILD_KEY, String(latestBuild))
    setDismissedBuild(latestBuild)
  }

  return (
    <View className="bg-brand-600 px-4 py-3 flex-row items-center gap-3">
      <Download size={18} color="white" />
      <View className="flex-1">
        <Text className="text-sm font-bold text-white">{t('common.updateAvailable')}</Text>
        <Text className="text-xs text-white/80">{t('common.updateAvailableBody')}</Text>
      </View>
      <TouchableOpacity
        onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
        className="bg-white/20 rounded-lg px-3 py-2 min-h-touch justify-center"
      >
        <Text className="text-xs font-bold text-white">{t('common.download')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} className="w-8 h-8 items-center justify-center">
        <X size={16} color="white" />
      </TouchableOpacity>
    </View>
  )
}
