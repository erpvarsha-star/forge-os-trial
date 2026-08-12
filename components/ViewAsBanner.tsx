import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Eye, X } from 'lucide-react-native'
import { useViewAsStore } from '@/hooks/useViewAs'
import { useEffectiveIdentity } from '@/hooks/useEffectiveIdentity'

/**
 * Sticky notice shown whenever an admin is viewing the app as someone else.
 *
 * This is not decoration. Without it, an owner who switched to the member
 * view an hour ago sees the worker screens and has no way to tell whether
 * that is a bug, a permissions problem, or their own earlier click — and the
 * screens themselves look completely normal. The banner is the only thing
 * distinguishing "the app is broken" from "you are wearing someone else's
 * hat", so it is deliberately loud and always carries an exit.
 *
 * Mounted once in the root layout, above the navigator, so it survives every
 * navigation and cannot be lost behind a screen that forgot to include it.
 */
export function ViewAsBanner() {
  const { t } = useTranslation()
  const router = useRouter()
  const { role, department, isViewingAs } = useEffectiveIdentity()
  const clear = useViewAsStore(s => s.clear)

  if (!isViewingAs) return null

  const exit = async () => {
    await clear()
    // Back to the router so the admin's own role group is re-resolved.
    router.replace('/')
  }

  const label = [role?.replace(/_/g, ' '), department].filter(Boolean).join(' · ')

  return (
    <View className="bg-amber-500 px-4 py-2 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2 flex-1 pr-2">
        <Eye size={16} color="#ffffff" />
        <Text className="text-xs font-bold text-white flex-1" numberOfLines={1}>
          {t('viewAs.banner', { what: label })}
        </Text>
      </View>
      <TouchableOpacity onPress={exit} className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-white/20">
        <X size={12} color="#ffffff" />
        <Text className="text-xs font-bold text-white">{t('viewAs.exit')}</Text>
      </TouchableOpacity>
    </View>
  )
}
