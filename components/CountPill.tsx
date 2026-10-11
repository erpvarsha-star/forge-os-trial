import React from 'react'
import { View, Text } from 'react-native'

/** Red count pill for More-menu rows. Renders nothing at 0. */
export function CountPill({ count }: { count: number }) {
  if (!count || count <= 0) return null
  return (
    <View className="bg-status-rejected rounded-full min-w-[22px] px-1.5 py-0.5 items-center">
      <Text className="text-xs font-bold text-white">{count}</Text>
    </View>
  )
}
