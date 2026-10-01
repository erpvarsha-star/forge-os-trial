import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useShiftCheckinSummary, CheckinCell, CheckinMatrixRow, CheckinCategory, CHECKIN_CATEGORIES } from '@/hooks/useShiftCheckinSummary'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { LoadingScreen } from '@/components/LoadingScreen'
import { LogIn, LogOut, Users } from 'lucide-react-native'
import { BRAND, INK, STATUS } from '@/components/theme'

const CATEGORY_LABEL: Record<CheckinCategory, string> = {
  worker: 'Worker', staff: 'Staff', consultant: 'Consultant', other: 'Other',
}

const COL_WIDTH = 76
const SHIFT_COL_WIDTH = 108

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <Card className="flex-1" variant="flat">
      <View className="flex-row items-center gap-2 mb-1">{icon}<Text className="text-xs text-ink-500">{label}</Text></View>
      <Text className="text-2xl font-bold" style={{ color: tone || INK[900] }}>{value}</Text>
    </Card>
  )
}

function Cell({ cell }: { cell: CheckinCell }) {
  if (cell.in === 0 && cell.out === 0) {
    return <View style={{ width: COL_WIDTH }} className="items-center"><Text className="text-xs text-ink-300">—</Text></View>
  }
  return (
    <View style={{ width: COL_WIDTH }} className="items-center">
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-bold text-ink-900">{cell.in}</Text>
        {cell.stillIn > 0 && (
          <View className="px-1.5 rounded-full" style={{ backgroundColor: STATUS.late.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: STATUS.late.fg }}>+{cell.stillIn}</Text>
          </View>
        )}
      </View>
      <Text className="text-[11px] text-ink-400">{cell.out} out</Text>
    </View>
  )
}

function MatrixRow({ row, isTotal }: { row: CheckinMatrixRow; isTotal?: boolean }) {
  return (
    <View className={`flex-row items-center py-2.5 ${isTotal ? 'border-t-2 border-ink-200 mt-1 pt-3' : 'border-b border-ink-50'}`}>
      <View style={{ width: SHIFT_COL_WIDTH }}>
        <Text className={`text-xs ${isTotal ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`} numberOfLines={1}>
          {row.shiftName}
        </Text>
        {row.startTime && <Text className="text-[10px] text-ink-400">{row.startTime}</Text>}
      </View>
      {CHECKIN_CATEGORIES.map(cat => <Cell key={cat} cell={row.byCategory[cat]} />)}
      <Cell cell={row.total} />
    </View>
  )
}

export function ShiftCheckinSummary() {
  const { t } = useTranslation()
  const { employee } = useAuth()
  const {
    date, isToday, showToday, showYesterday, isLoading,
    rows, totalIn, totalOut, stillCheckedIn, byCategory,
  } = useShiftCheckinSummary()

  if (!employee) return <LoadingScreen />

  const categoriesWithData = CHECKIN_CATEGORIES.filter(cat => byCategory[cat].in > 0)
  const totalRow: CheckinMatrixRow = { shiftName: t('shiftCheckin.total'), startTime: null, byCategory, total: { in: totalIn, out: totalOut, stillIn: stillCheckedIn } }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-4">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('shiftCheckin.title')}</Text>
          <Text className="text-sm text-ink-500 mt-1">{date}</Text>
        </View>

        <Card className="mb-4" variant="flat">
          <View className="flex-row bg-ink-100 rounded-lg p-1">
            <TouchableOpacity className={`flex-1 rounded-md py-2 items-center ${isToday ? 'bg-white' : ''}`} onPress={showToday}>
              <Text className={`text-sm font-semibold ${isToday ? 'text-ink-900' : 'text-ink-500'}`}>{t('shiftCheckin.today')}</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-1 rounded-md py-2 items-center ${!isToday ? 'bg-white' : ''}`} onPress={showYesterday}>
              <Text className={`text-sm font-semibold ${!isToday ? 'text-ink-900' : 'text-ink-500'}`}>{t('shiftCheckin.yesterday')}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {isLoading ? (
          <LoadingScreen />
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <StatTile icon={<LogIn size={14} color={BRAND[600]} />} label={t('shiftCheckin.totalIn')} value={totalIn} />
              <StatTile icon={<LogOut size={14} color={INK[500]} />} label={t('shiftCheckin.totalOut')} value={totalOut} />
              <StatTile icon={<Users size={14} color={STATUS.late.fg} />} label={t('shiftCheckin.stillIn')} value={stillCheckedIn} tone={stillCheckedIn > 0 ? STATUS.late.fg : undefined} />
            </View>

            {categoriesWithData.length > 0 && (
              <Card className="mb-4" variant="flat">
                <Text className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">{t('shiftCheckin.byCategory')}</Text>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                  {categoriesWithData.map(cat => (
                    <Text key={cat} className="text-sm text-ink-700">
                      <Text className="font-bold">{byCategory[cat].in}</Text> {CATEGORY_LABEL[cat]}
                    </Text>
                  ))}
                </View>
              </Card>
            )}

            <Card title={t('shiftCheckin.matrixTitle')}>
              {rows.length === 0 ? (
                <Text className="text-sm text-ink-500 text-center py-6">{t('shiftCheckin.noCheckins')}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View className="flex-row items-end pb-2 border-b border-ink-200">
                      <View style={{ width: SHIFT_COL_WIDTH }}><Text className="text-[10px] font-bold uppercase text-ink-400">{t('shiftCheckin.shift')}</Text></View>
                      {CHECKIN_CATEGORIES.map(cat => (
                        <View key={cat} style={{ width: COL_WIDTH }} className="items-center">
                          <Text className="text-[10px] font-bold uppercase text-ink-400">{CATEGORY_LABEL[cat]}</Text>
                        </View>
                      ))}
                      <View style={{ width: COL_WIDTH }} className="items-center"><Text className="text-[10px] font-bold uppercase text-ink-400">{t('shiftCheckin.total')}</Text></View>
                    </View>
                    {rows.map(row => <MatrixRow key={row.shiftName} row={row} />)}
                    <MatrixRow row={totalRow} isTotal />
                  </View>
                </ScrollView>
              )}
            </Card>
            <Text className="text-[11px] text-ink-400 mt-3">{t('shiftCheckin.badgeHint')}</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

export default ShiftCheckinSummary
