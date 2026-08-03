import { Tabs } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BarChart3, Users, CreditCard, Calendar, MoreHorizontal } from 'lucide-react-native'

export default function HrAdminLayout() {
  const { t } = useTranslation()
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
      <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
      <Tabs.Screen name="new-employee-flow" options={{ title: t('hrAdmin.employeeMaster'), tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
      <Tabs.Screen name="advance-ledger" options={{ title: t('common.payroll'), tabBarIcon: ({ color }) => <CreditCard size={22} color={color} /> }} />
      <Tabs.Screen name="shifts" options={{ title: t('hrAdmin.shiftPlanning'), tabBarIcon: ({ color }) => <Calendar size={22} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
      <Tabs.Screen name="missing-data" options={{ href: null }} />
    </Tabs>
  )
}
