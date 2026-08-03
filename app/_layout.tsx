import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import '@/i18n'

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(supervisor)" />
        <Stack.Screen name="(manager)" />
        <Stack.Screen name="(plant-head)" />
        <Stack.Screen name="(hr-admin)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(security)" />
      </Stack>
      <StatusBar style="dark" />
    </>
  )
}
