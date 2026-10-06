import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/Card'
import {
  useShiftCheckinSummary,
  UNASSIGNED_ROW,
  UNKNOWN_CATEGORY,
  type ShiftCheckinCell,
} from '@/hooks/useShiftCheckinSummary'
import { BRAND, INK } from '@/components/theme'

const LABEL_COL_WIDTH = 96
const DATA_COL_WIDTH = 42
const ROW_HEIGHT = 44
const HEADER_ROW_HEIGHT = 26
const SUBHEADER_ROW_HEIGHT = 26

function categoryLabel(cat: string): string {
  if (cat === UNKNOWN_CATEGORY) return '—'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

function fmtDateLabel(dateStr: string): string {
  // dateStr is a plain YYYY-MM-DD IST calendar date, not a timestamp — format
  // it as UTC so this doesn't re-shift by the local device's own timezone.
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function Cell({ cell, bold = false }: { cell: ShiftCheckinCell; bold?: boolean }) {
  return (
    <View style={{ width: DATA_COL_WIDTH, height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Text className={`text-xs ${bold ? 'font-extrabold text-ink-900' : cell.checkIns === 0 ? 'text-ink-300' : 'font-semibold text-ink-900'}`}>
        {cell.checkIns}
      </Text>
    </View>
  )
}

function OutCell({ cell, bold = false }: { cell: ShiftCheckinCell; bold?: boolean }) {
  const gap = cell.checkIns - cell.checkOuts
  return (
    <View style={{ width: DATA_COL_WIDTH, height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Text className={`text-xs ${bold ? 'font-extrabold' : cell.checkOuts === 0 ? 'text-ink-300' : 'font-semibold'}`} style={{ color: cell.checkOuts === 0 && !bold ? undefined : '#0F7A4A' }}>
        {cell.checkOuts}
      </Text>
      {gap > 0 && (
        <Text className="text-2xs font-bold" style={{ color: '#B45309' }}>
          +{gap}
        </Text>
      )}
    </View>
  )
}

/**
 * Shared "Shift Check-in Summary" table — Today/Yesterday toggle, shift x
 * category check-in/check-out counts, Total row and column. Reached from
 * Owner / Plant Head / HR Admin's More screen (see each role's
 * shift-summary.tsx thin wrapper), same href:null + more.tsx pattern used
 * for Shift Allocation on 28 Sep 2026.
 */
export function ShiftCheckinSummary() {
  const { t } = useTranslation()
  const { period, setPeriod, today, yesterday, categories, data, isLoading, error } = useShiftCheckinSummary()

  const rowLabel = (shiftName: string) =>
    shiftName === UNASSIGNED_ROW ? t('shiftCheckinSummary.unassigned') : shiftName

  return (
    <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
      <Text className="text-2xl font-bold text-ink-900 tracking-tight mb-1">
        {t('shiftCheckinSummary.title')}
      </Text>
      <Text className="text-sm text-ink-500 mb-4">{t('shiftCheckinSummary.subtitle')}</Text>

      <View className="flex-row bg-white rounded-xl border border-ink-200 p-1 mb-5 self-start">
        <TouchableOpacity
          onPress={() => setPeriod('today')}
          className={`px-4 py-2 rounded-lg ${period === 'today' ? '' : ''}`}
          style={{ backgroundColor: period === 'today' ? BRAND[600] : 'transparent' }}
        >
          <Text className={`text-sm font-bold ${period === 'today' ? 'text-white' : 'text-ink-500'}`}>
            {t('common.today')} · {fmtDateLabel(today)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPeriod('yesterday')}
          className="px-4 py-2 rounded-lg"
          style={{ backgroundColor: period === 'yesterday' ? BRAND[600] : 'transparent' }}
        >
          <Text className={`text-sm font-bold ${period === 'yesterday' ? 'text-white' : 'text-ink-500'}`}>
            {t('common.yesterday')} · {fmtDateLabel(yesterday)}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator color={BRAND[600]} />
        </View>
      ) : error ? (
        <Card className="py-10 items-center">
          <Text className="text-sm text-status-absent text-center">{t('common.somethingWentWrong')}</Text>
        </Card>
      ) : !data ? null : (
        <>
          <View className="flex-row flex-wrap gap-3 mb-4">
            <Card className="flex-1 min-w-[100px]" variant="flat">
              <Text className="text-2xs font-bold text-ink-400 uppercase tracking-wider mb-1">
                {t('shiftCheckinSummary.totalCheckedIn')}
              </Text>
              <Text className="text-xl font-extrabold text-ink-900">{data.grandTotal.checkIns}</Text>
            </Card>
            <Card className="flex-1 min-w-[100px]" variant="flat">
              <Text className="text-2xs font-bold text-ink-400 uppercase tracking-wider mb-1">
                {t('shiftCheckinSummary.totalCheckedOut')}
              </Text>
              <Text className="text-xl font-extrabold" style={{ color: '#0F7A4A' }}>
                {data.grandTotal.checkOuts}
              </Text>
            </Card>
            <Card className="flex-1 min-w-[100px]" variant="flat">
              <Text className="text-2xs font-bold text-ink-400 uppercase tracking-wider mb-1">
                {t('shiftCheckinSummary.stillCheckedIn')}
              </Text>
              <Text className="text-xl font-extrabold" style={{ color: '#B45309' }}>
                {data.grandTotal.checkIns - data.grandTotal.checkOuts}
              </Text>
            </Card>
          </View>

          <Card className="mb-3" variant="flat">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-ink-900">{t('shiftCheckinSummary.tableTitle')}</Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: INK[400] }} />
                  <Text className="text-2xs text-ink-500">{t('common.checkIn')}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0F7A4A' }} />
                  <Text className="text-2xs text-ink-500">{t('common.checkOut')}</Text>
                </View>
              </View>
            </View>

            <View className="flex-row">
              {/* Fixed shift-name column, stays in place while the category
                  grid beside it scrolls horizontally — RN has no CSS sticky
                  position, so this two-pane split achieves the same effect. */}
              <View style={{ width: LABEL_COL_WIDTH }}>
                <View style={{ height: HEADER_ROW_HEIGHT }} />
                <View style={{ height: SUBHEADER_ROW_HEIGHT, justifyContent: 'center' }}>
                  <Text className="text-2xs font-bold text-ink-400 uppercase">{t('shiftCheckinSummary.shiftColumn')}</Text>
                </View>
                {data.rows.map(row => (
                  <View key={row.shiftName} style={{ height: ROW_HEIGHT, justifyContent: 'center' }} className="border-t border-ink-50">
                    <Text
                      className={`text-xs font-bold ${row.isUnassigned ? 'italic text-ink-500' : 'text-ink-900'}`}
                      numberOfLines={1}
                    >
                      {rowLabel(row.shiftName)}
                    </Text>
                  </View>
                ))}
                <View style={{ height: ROW_HEIGHT, justifyContent: 'center' }} className="border-t border-brand-100">
                  <Text className="text-xs font-extrabold text-ink-900">{t('common.total')}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Category group header */}
                  <View style={{ height: HEADER_ROW_HEIGHT }} className="flex-row">
                    {categories.map(cat => (
                      <View
                        key={cat}
                        style={{ width: DATA_COL_WIDTH * 2, justifyContent: 'center', alignItems: 'center' }}
                        className="border-l border-ink-100"
                      >
                        <Text className="text-2xs font-bold text-ink-500" numberOfLines={1}>
                          {categoryLabel(cat)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ width: DATA_COL_WIDTH * 2, justifyContent: 'center', alignItems: 'center' }} className="border-l border-ink-100">
                      <Text className="text-2xs font-bold text-ink-500">{t('common.total')}</Text>
                    </View>
                  </View>
                  {/* In/Out sub-header */}
                  <View style={{ height: SUBHEADER_ROW_HEIGHT }} className="flex-row">
                    {categories.map(cat => (
                      <React.Fragment key={cat}>
                        <View style={{ width: DATA_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }} className="border-l border-ink-100">
                          <Text className="text-2xs font-semibold text-ink-400">{t('shiftCheckinSummary.in')}</Text>
                        </View>
                        <View style={{ width: DATA_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
                          <Text className="text-2xs font-semibold text-ink-400">{t('shiftCheckinSummary.out')}</Text>
                        </View>
                      </React.Fragment>
                    ))}
                    <View style={{ width: DATA_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }} className="border-l border-ink-100">
                      <Text className="text-2xs font-semibold text-ink-400">{t('shiftCheckinSummary.in')}</Text>
                    </View>
                    <View style={{ width: DATA_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
                      <Text className="text-2xs font-semibold text-ink-400">{t('shiftCheckinSummary.out')}</Text>
                    </View>
                  </View>

                  {/* Data rows */}
                  {data.rows.map(row => (
                    <View key={row.shiftName} style={{ height: ROW_HEIGHT }} className="flex-row border-t border-ink-50">
                      {categories.map(cat => (
                        <React.Fragment key={cat}>
                          <View className="border-l border-ink-100">
                            <Cell cell={row.byCategory[cat]} />
                          </View>
                          <OutCell cell={row.byCategory[cat]} />
                        </React.Fragment>
                      ))}
                      <View className="border-l border-ink-100">
                        <Cell cell={row.total} bold />
                      </View>
                      <OutCell cell={row.total} bold />
                    </View>
                  ))}

                  {/* Total row */}
                  <View style={{ height: ROW_HEIGHT }} className="flex-row border-t border-brand-100">
                    {categories.map(cat => {
                      const colTotal = data.rows.reduce(
                        (acc, r) => ({
                          checkIns: acc.checkIns + r.byCategory[cat].checkIns,
                          checkOuts: acc.checkOuts + r.byCategory[cat].checkOuts,
                        }),
                        { checkIns: 0, checkOuts: 0 }
                      )
                      return (
                        <React.Fragment key={cat}>
                          <View className="border-l border-ink-100">
                            <Cell cell={colTotal} bold />
                          </View>
                          <OutCell cell={colTotal} bold />
                        </React.Fragment>
                      )
                    })}
                    <View className="border-l border-ink-100">
                      <Cell cell={data.grandTotal} bold />
                    </View>
                    <OutCell cell={data.grandTotal} bold />
                  </View>
                </View>
              </ScrollView>
            </View>
          </Card>

          <Text className="text-xs text-ink-400 leading-5">{t('shiftCheckinSummary.securityFootnote')}</Text>
        </>
      )}
    </ScrollView>
  )
}
