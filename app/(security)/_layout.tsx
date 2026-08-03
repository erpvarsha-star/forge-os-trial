import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Truck, UserCheck, ShieldCheck } from 'lucide-react-native'

export default function SecurityLayout() {
  const { t } = useTranslation()
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
      <Tabs.Screen name="dashboard" options={{ title: t('security.vehicleLog'), tabBarIcon: ({ color }) => <Truck size={22} color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: t('security.checkpoint2'), tabBarIcon: ({ color }) => <UserCheck size={22} color={color} /> }} />
      <Tabs.Screen name="eod-lock" options={{ title: t('security.eodConfirmation'), tabBarIcon: ({ color }) => <ShieldCheck size={22} color={color} /> }} />
    </Tabs>
  )
}
