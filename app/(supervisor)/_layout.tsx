import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Users, ClipboardList, CheckCircle, MoreHorizontal } from 'lucide-react-native'

export default function SupervisorLayout() {
  const { t } = useTranslation()
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
      <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: t('common.team'), tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: t('common.tasks'), tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: t('common.approvals'), tabBarIcon: ({ color }) => <CheckCircle size={22} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
    </Tabs>
  )
}
