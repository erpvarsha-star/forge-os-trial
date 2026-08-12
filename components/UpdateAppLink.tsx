import React from 'react'
import { View, Text, TouchableOpacity, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Download, CheckCircle2 } from 'lucide-react-native'
import { useAppVersion } from '@/hooks/useAppVersion'
import { BRAND, INK } from '@/components/theme'

// Permanent link — GitHub Releases' "latest" alias always resolves to the
// most recent build published by .github/workflows/build-apk.yml.
const APK_DOWNLOAD_URL =
  'https://github.com/erpvarsha-star/forge-os-trial/releases/latest/download/app-release.apk'

/**
 * "Download Latest App" row on every role's More screen.
 *
 * Stays tappable at all times — someone with a corrupted install needs to be
 * able to re-download even when they are already on the newest build — but the
 * row now states which build they are actually running and whether it is
 * current, rather than being an unlabelled button that gives no feedback.
 *
 * It previously showed `expoConfig.version` ("1.0.0"), which is hand-maintained
 * and identical on every build, so it could never tell anyone which APK they
 * had.
 */
export function UpdateAppLink() {
  const { t } = useTranslation()
  const { currentBuild, isUpdateAvailable, isChecking, checkFailed } = useAppVersion()

  const versionLabel =
    currentBuild !== null
      ? t('common.versionBuild', { build: currentBuild })
      : t('common.versionUnknown')

  const statusLine = () => {
    if (isChecking) return t('common.checkingForUpdates')
    if (isUpdateAvailable) return t('common.updateAvailable')
    if (checkFailed) return t('common.updateCheckFailed')
    return t('common.upToDate')
  }

  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
      className={`rounded-xl p-4 mb-2 flex-row items-center justify-between border min-h-touch ${
        isUpdateAvailable ? 'bg-brand-50 border-brand-200' : 'bg-white border-ink-100 shadow-sm'
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        {isUpdateAvailable ? (
          <Download size={20} color={BRAND[600]} />
        ) : (
          <CheckCircle2 size={20} color={INK[400]} />
        )}
        <View className="flex-1">
          <Text className={`text-base ${isUpdateAvailable ? 'font-bold text-brand-700' : 'text-ink-900'}`}>
            {t('common.updateApp')}
          </Text>
          {/* Installed build first — this is the number a worker reads out when
              HR asks which version they are on. */}
          <Text className="text-xs text-ink-500 mt-0.5">
            {versionLabel} · {statusLine()}
          </Text>
        </View>
      </View>

      {isUpdateAvailable && (
        <View className="bg-brand-600 rounded-full px-2.5 py-1">
          <Text className="text-2xs font-bold text-white">{t('common.new')}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
