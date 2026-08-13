import { Tabs } from 'expo-router'
import { RoleGate } from '@/components/RoleGate'
import { useTranslation } from 'react-i18next'
import { BarChart3, CheckCircle, FileText, Mail, MoreHorizontal } from 'lucide-react-native'

export default function PlantHeadLayout() {
  const { t } = useTranslation()
  return (
    <RoleGate allow={['plant_head']}>
  <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
        <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
        <Tabs.Screen name="approvals" options={{ title: t('common.approvals'), tabBarIcon: ({ color }) => <CheckCircle size={22} color={color} /> }} />
        <Tabs.Screen name="mrm" options={{ title: 'MRM', tabBarIcon: ({ color }) => <FileText size={22} color={color} /> }} />
        <Tabs.Screen name="email" options={{ title: t('plantHead.emailDashboard'), tabBarIcon: ({ color }) => <Mail size={22} color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
      </Tabs>
    </RoleGate>
  )
}
