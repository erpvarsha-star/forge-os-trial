import React from 'react'
import { View, Text } from 'react-native'
import { AttendanceRecord } from '@/types'
import { ATTENDANCE_STATUS_LABELS } from '@/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns'
import { ATTENDANCE_STATUS_TOKEN, STATUS } from './theme'

interface AttendanceCalendarProps {
  records: AttendanceRecord[]
  month: number
  year: number
}

export function AttendanceCalendar({ records, month, year }: AttendanceCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month - 1)),
    end: endOfMonth(new Date(year, month - 1)),
  })

  const firstDayOfWeek = getDay(days[0])
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()

  const getStatusForDate = (dateStr: string) => {
    const record = records.find(r => r.date === dateStr)
    return record?.status || null
  }

  return (
    <View className="bg-white rounded-card p-4 border border-ink-100 shadow-card">
      <Text className="text-base font-bold text-ink-900 mb-4 tracking-tight">
        {format(new Date(year, month - 1), 'MMMM yyyy')}
      </Text>
      <View className="flex-row justify-between mb-2">
        {weekDays.map(d => (
          <Text key={d} className="text-2xs font-semibold text-ink-400 w-10 text-center uppercase">{d}</Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <View key={`empty-${i}`} className="w-10 h-10" />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const status = getStatusForDate(dateStr)
          const tone = status ? STATUS[ATTENDANCE_STATUS_TOKEN[status as keyof typeof ATTENDANCE_STATUS_TOKEN]] : null
          const isToday = isSameDay(day, today)

          return (
            <View key={dateStr} className="w-10 h-10 items-center justify-center p-0.5">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${isToday ? 'border-2 border-brand-600' : ''}`}
                style={{ backgroundColor: tone ? tone.bg : '#F6F7F9' }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: tone ? tone.fg : '#646D80' }}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-2 mt-4 pt-3 border-t border-ink-100">
        {Object.entries(ATTENDANCE_STATUS_LABELS).map(([key, label]) => {
          const tone = STATUS[ATTENDANCE_STATUS_TOKEN[key as keyof typeof ATTENDANCE_STATUS_TOKEN]]
          return (
            <View key={key} className="flex-row items-center gap-1.5">
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tone.fg }} />
              <Text className="text-2xs text-ink-500">{label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
