import { Tabs } from 'expo-router'
import { RoleGate } from '@/components/RoleGate'
import { useTranslation } from 'react-i18next'
import { Home, Calendar, Trophy, FileText, MoreHorizontal } from 'lucide-react-native'

export default function WorkerLayout() {
  const { t } = useTranslation()

  return (
    <RoleGate allow={['member']}>
  <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#E65C00',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: { paddingBottom: 8, height: 64 },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: t('common.home'),
            tabBarIcon: ({ color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: t('common.attendance'),
            tabBarIcon: ({ color }) => <Calendar size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="score"
          options={{
            title: t('common.score'),
            tabBarIcon: ({ color }) => <Trophy size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leave"
          options={{
            title: t('common.leave'),
            tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t('common.more'),
            tabBarIcon: ({ color }) => <MoreHorizontal size={22} color={color} />,
          }}
        />
        {/* Hidden screens — navigated to programmatically, not shown in tab bar */}
        <Tabs.Screen name="advance" options={{ href: null }} />
        <Tabs.Screen name="payslip" options={{ href: null }} />
        <Tabs.Screen name="5s" options={{ href: null }} />
        <Tabs.Screen name="observation" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="qr" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  )
}
