import { Tabs } from 'expo-router'
import { RoleGate } from '@/components/RoleGate'
import { useTranslation } from 'react-i18next'
import { BarChart3, TrendingUp, CheckCircle, Bell, MoreHorizontal } from 'lucide-react-native'

export default function OwnerLayout() {
  const { t } = useTranslation()
  return (
    <RoleGate allow={['owner']}>
  <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
        <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
        <Tabs.Screen name="kpi" options={{ title: t('owner.kpiDashboard'), tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} /> }} />
        <Tabs.Screen name="approvals" options={{ title: t('common.approvals'), tabBarIcon: ({ color }) => <CheckCircle size={22} color={color} /> }} />
        <Tabs.Screen name="alerts" options={{ title: t('owner.fraudAlerts'), tabBarIcon: ({ color }) => <Bell size={22} color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
        <Tabs.Screen name="eotm" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
