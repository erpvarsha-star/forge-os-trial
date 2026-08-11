import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Home, Calendar, Trophy, FileText, MoreHorizontal, Users, ClipboardList, CheckCircle, BarChart3 } from 'lucide-react-native'
import { usePathname, router } from 'expo-router'
import { BRAND } from './theme'

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
    <View className="bg-white border-t border-ink-100 flex-row justify-around items-stretch pt-1.5 pb-6 shadow-elevated">
      {tabs.map(tab => {
        const isActive = pathname.includes(tab.path)
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => router.push(tab.path as any)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="flex-1 items-center justify-center min-h-touch px-1 py-1.5"
          >
            <View className={`items-center justify-center rounded-lg px-3 py-1 ${isActive ? 'bg-brand-50' : ''}`}>
              {React.cloneElement(tab.icon as React.ReactElement, {
                color: isActive ? BRAND[600] : '#8B93A3',
                size: 22,
              })}
            </View>
            <Text
              className={`text-2xs mt-1 text-center ${isActive ? 'text-brand-700 font-bold' : 'text-ink-500 font-medium'}`}
              numberOfLines={1}
            >
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
