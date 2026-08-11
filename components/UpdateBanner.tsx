import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Download, X } from 'lucide-react-native'

const RELEASE_API = 'https://api.github.com/repos/erpvarsha-star/forge-os-trial/releases/latest'
const APK_DOWNLOAD_URL =
  'https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk'

const LAST_CHECK_KEY = 'updateBanner.lastCheckAt'
const DISMISSED_TAG_KEY = 'updateBanner.dismissedTag'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

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
  const [latestTag, setLatestTag] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const lastCheck = Number((await AsyncStorage.getItem(LAST_CHECK_KEY)) ?? 0)
        if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return

        // Never let a version check block or slow the app on a bad shop-floor
        // connection — bail out rather than hang.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(RELEASE_API, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!res.ok) return

        const json = await res.json()
        const tag: string | undefined = json?.tag_name
        if (!tag || cancelled) return

        await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()))

        const dismissed = await AsyncStorage.getItem(DISMISSED_TAG_KEY)
        if (dismissed === tag) return

        const latestBuild = parseInt(tag.replace(/\D/g, ''), 10)
        const installedBuild = Number(
          Constants.expoConfig?.android?.versionCode ?? Constants.nativeBuildVersion ?? 0
        )

        // Only prompt when we can actually establish that the release is
        // newer. If either number is unreadable, stay silent rather than
        // nagging every launch with a possibly-wrong "update available".
        if (Number.isFinite(latestBuild) && installedBuild > 0 && latestBuild > installedBuild) {
          if (!cancelled) setLatestTag(tag)
        }
      } catch {
        // Offline, rate-limited, DNS failure — all non-events. The banner
        // simply does not appear.
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (!latestTag) return null

  const dismiss = async () => {
    await AsyncStorage.setItem(DISMISSED_TAG_KEY, latestTag)
    setLatestTag(null)
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
