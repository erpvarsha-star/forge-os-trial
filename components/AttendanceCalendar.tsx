import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import { AttendanceRecord } from '@/types'
import { ATTENDANCE_STATUS_COLORS, ATTENDANCE_STATUS_LABELS } from '@/constants'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'

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

  const getStatusForDate = (dateStr: string) => {
    const record = records.find(r => r.date === dateStr)
    return record?.status || null
  }

  return (
    <View className="bg-white rounded-xl p-4">
      <Text className="text-lg font-bold text-gray-900 mb-4">
        {format(new Date(year, month - 1), 'MMMM yyyy')}
      </Text>
      <View className="flex-row justify-between mb-2">
        {weekDays.map(d => (
          <Text key={d} className="text-xs text-gray-500 w-10 text-center">{d}</Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <View key={`empty-${i}`} className="w-10 h-10" />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const status = getStatusForDate(dateStr)
          const bgColor = status ? ATTENDANCE_STATUS_COLORS[status] : 'bg-gray-100'
          const textColor = status ? 'text-white' : 'text-gray-700'

          return (
            <View key={dateStr} className="w-10 h-10 items-center justify-center p-0.5">
              <View className={`w-8 h-8 rounded-full items-center justify-center ${bgColor}`}>
                <Text className={`text-xs font-medium ${textColor}`}>{format(day, 'd')}</Text>
              </View>
            </View>
          )
        })}
      </View>
      <View className="flex-row flex-wrap gap-2 mt-4">
        {Object.entries(ATTENDANCE_STATUS_LABELS).map(([key, label]) => (
          <View key={key} className="flex-row items-center gap-1">
            <View className={`w-3 h-3 rounded-full ${ATTENDANCE_STATUS_COLORS[key]}`} />
            <Text className="text-xs text-gray-600">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
