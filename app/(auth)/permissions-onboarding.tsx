import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MapPin, Camera, Bell } from 'lucide-react-native'
import { router } from 'expo-router'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/Button'
import { requestAllPermissions, PERMISSIONS_DONE_KEY } from '@/lib/permissions'
import { INK, STATUS } from '@/components/theme'

const PERMISSIONS = [
  {
    key: 'location',
    icon: (color: string) => <MapPin size={22} color={color} />,
    titleKey: 'auth.permLocation',
    hintKey: 'auth.permLocationHint',
  },
  {
    key: 'camera',
    icon: (color: string) => <Camera size={22} color={color} />,
    titleKey: 'auth.permCamera',
    hintKey: 'auth.permCameraHint',
  },
  {
    key: 'notifications',
    icon: (color: string) => <Bell size={22} color={color} />,
    titleKey: 'auth.permNotifications',
    hintKey: 'auth.permNotificationsHint',
  },
] as const

/**
 * One-time permission request screen, shown after first login / first PIN
 * change. Presents all three permissions with plain-language explanations so
 * employees understand why each dialog appears before it does.
 *
 * Stored in AsyncStorage under PERMISSIONS_DONE_KEY once dismissed (grant OR
 * skip), so it never shows again. The app's individual flows (GPS check-in,
 * QR scanner, push registration) request their own permissions lazily as a
 * safety net — those calls resolve immediately when already granted here.
 */
export default function PermissionsOnboardingScreen() {
  const { t } = useTranslation()
  const [isGranting, setIsGranting] = useState(false)

  const markDone = async () => {
    try {
      await AsyncStorage.setItem(PERMISSIONS_DONE_KEY, '1')
    } catch {}
    router.replace('/')
  }

  const handleGrant = async () => {
    setIsGranting(true)
    await requestAllPermissions()
    setIsGranting(false)
    await markDone()
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 items-center justify-center px-6 py-12">
        <BrandLogo size="md" />

        <Text className="text-xl font-bold text-ink-900 mt-6 mb-2 text-center">
          {t('auth.permissionsTitle')}
        </Text>
        <Text className="text-sm text-ink-500 mb-8 text-center">
          {t('auth.permissionsSubtitle')}
        </Text>

        <View className="w-full max-w-sm">
          {PERMISSIONS.map(perm => (
            <View
              key={perm.key}
              className="flex-row items-start gap-4 bg-ink-50 rounded-2xl p-4 mb-3"
            >
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center">
                {perm.icon(STATUS.info?.fg ?? INK[600])}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink-900">{t(perm.titleKey)}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{t(perm.hintKey)}</Text>
              </View>
            </View>
          ))}

          <View className="mt-4">
            {isGranting ? (
              <View className="h-12 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <Button
                title="auth.grantPermissions"
                onPress={handleGrant}
                size="lg"
              />
            )}

            <TouchableOpacity
              onPress={markDone}
              disabled={isGranting}
              className="mt-3 py-3 items-center"
            >
              <Text className="text-sm text-ink-400">{t('auth.skipForNow')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}
