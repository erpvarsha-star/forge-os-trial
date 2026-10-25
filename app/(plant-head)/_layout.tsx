import { Tabs } from 'expo-router'
import { RoleGate } from '@/components/RoleGate'
import { useTaskBadgeSync } from '@/hooks/useAssignedTasks'
import { useTranslation } from 'react-i18next'
import { BarChart3, CheckCircle, FileText, Send, ClipboardCheck, MoreHorizontal } from 'lucide-react-native'

export default function PlantHeadLayout() {
  const { t } = useTranslation()
  // One badge sync per layout (not per screen) — drives the More tab count.
  const badges = useTaskBadgeSync('plant-head')
  return (
    <RoleGate allow={['plant_head']}>
  <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
        <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
        <Tabs.Screen name="approvals" options={{ tabBarBadge: badges.approvals, title: t('common.approvals'), tabBarIcon: ({ color }) => <CheckCircle size={22} color={color} /> }} />
        <Tabs.Screen name="mrm" options={{ title: 'MRM', tabBarIcon: ({ color }) => <FileText size={22} color={color} /> }} />
        <Tabs.Screen name="team-tasks" options={{ tabBarBadge: badges.tasks, title: t('delegatedTasks.tabLabel'), tabBarIcon: ({ color }) => <Send size={22} color={color} /> }} />
        <Tabs.Screen name="forms" options={{ title: t('forms.tab'), tabBarIcon: ({ color }) => <ClipboardCheck size={22} color={color} /> }} />
        <Tabs.Screen name="more" options={{ tabBarBadge: badges.more, title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
        <Tabs.Screen name="email" options={{ href: null }} />
        <Tabs.Screen name="leave" options={{ href: null }} />
        <Tabs.Screen name="advance" options={{ href: null }} />
        <Tabs.Screen name="late-review" options={{ href: null }} />
        <Tabs.Screen name="shift-summary" options={{ href: null }} />
        <Tabs.Screen name="payslips" options={{ href: null }} />
        <Tabs.Screen name="payslip" options={{ href: null }} />
        <Tabs.Screen name="my-tasks" options={{ href: null }} />
        <Tabs.Screen name="efficiency" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
