import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Home, Calendar, Trophy, FileText, MoreHorizontal, Users, ClipboardList, CheckCircle, BarChart3, Bell, Settings } from 'lucide-react-native'
import { usePathname, router } from 'expo-router'

interface TabItem {
  key: string
  label: string
  icon: React.ReactNode
  path: string
}

interface TabBarProps {
  tabs: TabItem[]
}

export function TabBar({ tabs }: TabBarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()

  return (
    <View className="bg-white border-t border-gray-200 flex-row justify-around items-center py-2 pb-6">
      {tabs.map(tab => {
        const isActive = pathname.includes(tab.path)
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => router.push(tab.path as any)}
            className="items-center justify-center px-3 py-1"
          >
            {React.cloneElement(tab.icon as React.ReactElement, {
              color: isActive ? '#E65C00' : '#9CA3AF',
              size: 22,
            })}
            <Text className={`text-xs mt-1 ${isActive ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
              {t(tab.label)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export const WORKER_TABS: TabItem[] = [
  { key: 'home', label: 'common.home', icon: <Home />, path: '/(worker)/home' },
  { key: 'attendance', label: 'common.attendance', icon: <Calendar />, path: '/(worker)/attendance' },
  { key: 'score', label: 'common.score', icon: <Trophy />, path: '/(worker)/score' },
  { key: 'leave', label: 'common.leave', icon: <FileText />, path: '/(worker)/leave' },
  { key: 'more', label: 'common.more', icon: <MoreHorizontal />, path: '/(worker)/more' },
]

export const SUPERVISOR_TABS: TabItem[] = [
  { key: 'dashboard', label: 'common.dashboard', icon: <BarChart3 />, path: '/(supervisor)/dashboard' },
  { key: 'team', label: 'common.team', icon: <Users />, path: '/(supervisor)/team' },
  { key: 'tasks', label: 'common.tasks', icon: <ClipboardList />, path: '/(supervisor)/tasks' },
  { key: 'approvals', label: 'common.approvals', icon: <CheckCircle />, path: '/(supervisor)/approvals' },
  { key: 'more', label: 'common.more', icon: <MoreHorizontal />, path: '/(supervisor)/more' },
]
