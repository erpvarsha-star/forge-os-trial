import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLateComers, LateComer, ShortHoursEmployee, ShiftGroup } from '@/hooks/useLateComers'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ChevronLeft, ChevronRight, Clock, AlertTriangle, Hourglass } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Formats a stored check-in instant as an IST wall-clock time for display —
// not a date-boundary computation, so it's not covered by the istDate.ts
// helpers, but still must show IST (not the reviewer's device timezone) to
// be meaningful for a "review their timings" screen.
const formatIstTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'

function LateComerRow({ emp }: { emp: LateComer }) {
  return (
    <View className="py-3 border-b border-ink-50 last:border-b-0">
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-bold text-ink-900">{emp.name}</Text>
          <Text className="text-xs text-ink-500 font-mono">{emp.emp_code} • {emp.department}</Text>
        </View>
        <View className="px-2.5 py-1 rounded-full bg-red-50">
          <Text className="text-xs font-bold text-red-600">{emp.count}x late</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-1">
        {emp.occurrences.map((occ, i) => (
          <View key={i} className="flex-row items-center gap-1">
            <Clock size={11} color={INK[400]} />
            <Text className="text-xs text-ink-500">
              {occ.date.slice(5)} — {formatIstTime(occ.check_in_time)}
              {occ.late_minutes ? ` (+${occ.late_minutes}m)` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function ShortHoursRow({ emp, minWorkingHours }: { emp: ShortHoursEmployee; minWorkingHours: number }) {
  return (
    <View className="py-3 border-b border-ink-50 last:border-b-0">
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-bold text-ink-900">{emp.name}</Text>
          <Text className="text-xs text-ink-500 font-mono">{emp.emp_code} • {emp.department}</Text>
        </View>
        <View className="px-2.5 py-1 rounded-full bg-amber-50">
          <Text className="text-xs font-bold text-amber-700">{emp.count}x short</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-x-3 gap-y-1 mt-1">
        {emp.occurrences.map((occ, i) => (
          <View key={i} className="flex-row items-center gap-1">
            <Hourglass size={11} color={INK[400]} />
            <Text className="text-xs text-ink-500">
              {occ.date.slice(5)} — {occ.hours_worked.toFixed(2)}h (min {minWorkingHours}h)
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function ShiftGroupsSection<T extends { employee_id: string }>({
  groups,
  renderRow,
}: {
  groups: ShiftGroup<T>[]
  renderRow: (emp: T) => React.ReactNode
}) {
  return (
    <>
      {groups.map(group => (
        <Card key={group.shiftName} className="mb-3" title={`${group.shiftName}${group.startTime ? ` (${group.startTime})` : ''}`}>
          {group.employees.map(emp => (
            <View key={emp.employee_id}>{renderRow(emp)}</View>
          ))}
        </Card>
      ))}
    </>
  )
}

export function LateComersReview() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const {
    month, year, isLoading, goToPrevMonth, goToNextMonth, isCurrentMonth,
    lateGroups, shortHoursGroups, lateThreshold, minWorkingHours,
  } = useLateComers()

  if (!employee) return <LoadingScreen />

  const monthLabel = `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
  const totalLate = lateGroups.reduce((sum, g) => sum + g.employees.length, 0)
  const totalShort = shortHoursGroups.reduce((sum, g) => sum + g.employees.length, 0)

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-4">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('reports.lateComersReview')}</Text>
          <Text className="text-sm text-ink-500 mt-1">{t('reports.lateComersReviewHint', { count: lateThreshold })}</Text>
        </View>

        <Card className="mb-4" variant="flat">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={goToPrevMonth} className="p-2 -ml-2">
              <ChevronLeft size={22} color={BRAND[600]} />
            </TouchableOpacity>
            <Text className="text-base font-bold text-ink-900">{monthLabel}</Text>
            <TouchableOpacity onPress={goToNextMonth} disabled={isCurrentMonth} className="p-2 -mr-2">
              <ChevronRight size={22} color={isCurrentMonth ? '#D1D5DB' : BRAND[600]} />
            </TouchableOpacity>
          </View>
        </Card>

        {isLoading ? (
          <LoadingScreen />
        ) : (
          <>
            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('reports.lateSectionLabel')}</Text>
            {totalLate === 0 ? (
              <Card className="items-center py-8 mb-4">
                <AlertTriangle size={28} color="#D1D5DB" />
                <Text className="text-sm text-ink-500 mt-3 text-center">{t('reports.noChronicLateComers')}</Text>
              </Card>
            ) : (
              <ShiftGroupsSection groups={lateGroups} renderRow={(emp) => <LateComerRow emp={emp} />} />
            )}

            <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 mt-2">{t('reports.shortHoursSectionLabel')}</Text>
            <Text className="text-xs text-ink-500 mb-3">{t('reports.shortHoursHint', { hours: minWorkingHours })}</Text>
            {totalShort === 0 ? (
              <Card className="items-center py-8">
                <Hourglass size={28} color="#D1D5DB" />
                <Text className="text-sm text-ink-500 mt-3 text-center">{t('reports.noShortHours')}</Text>
              </Card>
            ) : (
              <ShiftGroupsSection groups={shortHoursGroups} renderRow={(emp) => <ShortHoursRow emp={emp} minWorkingHours={minWorkingHours} />} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

export default LateComersReview
