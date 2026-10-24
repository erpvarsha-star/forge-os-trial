import { Tabs } from 'expo-router'
import { RoleGate } from '@/components/RoleGate'
import { useTaskBadgeSync } from '@/hooks/useAssignedTasks'
import { useTranslation } from 'react-i18next'
import { BarChart3, Users, CreditCard, Send, ClipboardCheck, MoreHorizontal } from 'lucide-react-native'

export default function HrAdminLayout() {
  const { t } = useTranslation()
  // One badge sync per layout (not per screen) — drives the More tab count.
  const badges = useTaskBadgeSync('hr-admin')
  return (
    <RoleGate allow={['hr_admin']}>
  <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E65C00', tabBarInactiveTintColor: '#9CA3AF', tabBarStyle: { paddingBottom: 8, height: 64 } }}>
        <Tabs.Screen name="dashboard" options={{ title: t('common.dashboard'), tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} /> }} />
        <Tabs.Screen name="new-employee-flow" options={{ title: t('hrAdmin.employeeMaster'), tabBarIcon: ({ color }) => <Users size={22} color={color} /> }} />
        <Tabs.Screen name="advance-ledger" options={{ title: t('common.payroll'), tabBarIcon: ({ color }) => <CreditCard size={22} color={color} /> }} />
        <Tabs.Screen name="forms" options={{ title: t('forms.tab'), tabBarIcon: ({ color }) => <ClipboardCheck size={22} color={color} /> }} />
        <Tabs.Screen name="team-tasks" options={{ tabBarBadge: badges.tasks, title: t('delegatedTasks.tabLabel'), tabBarIcon: ({ color }) => <Send size={22} color={color} /> }} />
        <Tabs.Screen name="more" options={{ tabBarBadge: badges.more, title: t('common.more'), tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} /> }} />
        <Tabs.Screen name="shifts" options={{ href: null }} />
        <Tabs.Screen name="missing-data" options={{ href: null }} />
        <Tabs.Screen name="leave" options={{ href: null }} />
        <Tabs.Screen name="advance" options={{ href: null }} />
        <Tabs.Screen name="add-employee" options={{ href: null }} />
        <Tabs.Screen name="salary-request" options={{ href: null }} />
        <Tabs.Screen name="approvals" options={{ href: null }} />
        <Tabs.Screen name="late-review" options={{ href: null }} />
        <Tabs.Screen name="shift-summary" options={{ href: null }} />
        <Tabs.Screen name="payslips" options={{ href: null }} />
        <Tabs.Screen name="payslip" options={{ href: null }} />
        <Tabs.Screen name="my-tasks" options={{ href: null }} />
        <Tabs.Screen name="payroll-run" options={{ href: null }} />
        <Tabs.Screen name="statutory-reports" options={{ href: null }} />
        <Tabs.Screen name="payroll-feeds" options={{ href: null }} />
        <Tabs.Screen name="payroll-rates" options={{ href: null }} />
        <Tabs.Screen name="employee-exit" options={{ href: null }} />
        <Tabs.Screen name="payroll-warnings" options={{ href: null }} />
        <Tabs.Screen name="pune-attendance" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
