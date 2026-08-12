import React from 'react'
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ExternalLink, LayoutDashboard } from 'lucide-react-native'
import { useAuth } from '@/hooks/useAuth'
import { BRAND } from '@/components/theme'

/**
 * Opens the Factory OS operations dashboard (an external web page) in the
 * device browser.
 *
 * VISIBILITY: staff and board only — explicitly NOT shop-floor workers.
 * Gated on `employees.category === 'staff'` rather than on role, because role
 * alone is wrong here: an office employee has role 'member' and therefore
 * lands on the worker screens, but should still see this. Conversely the ~39
 * category='worker' employees must not, whatever screen they are on.
 *
 * Because the gate lives inside the component, it is safe to mount on every
 * role's home screen — it renders nothing for anyone who should not have it.
 *
 * The URL comes from EXPO_PUBLIC_FACTORY_OS_URL, inlined at build time by
 * Metro (see .github/workflows/build-apk.yml). If it is unset the button is
 * hidden entirely rather than shipping a dead link.
 */
const FACTORY_OS_URL = process.env.EXPO_PUBLIC_FACTORY_OS_URL

export function FactoryOsLink() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  if (!employee) return null
  if (employee.category !== 'staff') return null
  if (!FACTORY_OS_URL) return null

  const open = async () => {
    try {
      const supported = await Linking.canOpenURL(FACTORY_OS_URL)
      if (!supported) {
        Alert.alert(t('common.error'), t('common.cannotOpenLink'))
        return
      }
      await Linking.openURL(FACTORY_OS_URL)
    } catch {
      Alert.alert(t('common.error'), t('common.cannotOpenLink'))
    }
  }

  return (
    <TouchableOpacity
      onPress={open}
      className="bg-white rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between border border-ink-100 shadow-sm min-h-touch"
    >
      <View className="flex-row items-center gap-3 flex-1 pr-2">
        <View className="w-9 h-9 rounded-full bg-brand-50 items-center justify-center">
          <LayoutDashboard size={18} color={BRAND[600]} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-ink-900">{t('common.factoryOs')}</Text>
          <Text className="text-xs text-ink-500 mt-0.5">{t('common.factoryOsHint')}</Text>
        </View>
      </View>
      <ExternalLink size={16} color={BRAND[600]} />
    </TouchableOpacity>
  )
}
