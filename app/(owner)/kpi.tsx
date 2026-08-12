import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Dimensions, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/Header'
import { Card } from '@/components/Card'
import { Section } from '@/components/Section'
import { StatTile } from '@/components/StatTile'
import { EmptyState } from '@/components/EmptyState'
import { LoadingScreen } from '@/components/LoadingScreen'
import { supabase } from '@/lib/supabase'
import { ProductionSummary } from '@/components/ProductionSummary'
import { BarChart } from 'react-native-chart-kit'
import { Users, CalendarCheck, ShieldAlert, TrendingUp, BarChart3 } from 'lucide-react-native'
import { BRAND, INK } from '@/components/theme'

interface DeptRow {
  department: string
  value: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Plant-wide KPI dashboard for the owner.
 *
 * Previously rendered a hardcoded six-month bar series that looked live but
 * was invented. Everything here now comes from the database; where a figure
 * genuinely has no data yet the screen says so rather than drawing a chart of
 * zeroes that reads as a real (bad) result.
 */
export default function OwnerKPI() {
  const { t } = useTranslation()
  const { employee } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [headcount, setHeadcount] = useState(0)
  const [todayPct, setTodayPct] = useState(0)
  const [openAlerts, setOpenAlerts] = useState(0)
  const [monthTrend, setMonthTrend] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] })
  const [deptScores, setDeptScores] = useState<DeptRow[]>([])

  useEffect(() => { load() }, [employee])

  const load = async () => {
    const now = new Date()
    const year = now.getFullYear()
    const today = now.toISOString().split('T')[0]

    const { data: employees } = await supabase
      .from('employees')
      .select('id, department')
      .eq('is_active', true)

    const ids = (employees ?? []).map(e => e.id)
    setHeadcount(ids.length)

    if (ids.length === 0) { setIsLoading(false); setIsRefreshing(false); return }

    // Six months back, inclusive of the current one.
    const trendStart = new Date(year, now.getMonth() - 5, 1).toISOString().split('T')[0]

    const [{ data: todayRows }, { data: trendRows }, { data: alerts }, { data: scores }] = await Promise.all([
      supabase.from('attendance_records').select('status').eq('date', today),
      supabase.from('attendance_records').select('date, status').gte('date', trendStart),
      supabase.from('fraud_alerts').select('id').eq('status', 'open'),
      supabase.from('monthly_scores').select('employee_id, composite_score').eq('year', year),
    ])

    const todayWorking = (todayRows ?? []).filter(r => !['WO', 'H'].includes(r.status))
    const todayPresent = todayWorking.filter(r => ['P', 'HL'].includes(r.status))
    setTodayPct(todayWorking.length > 0 ? (todayPresent.length / todayWorking.length) * 100 : 0)

    setOpenAlerts(alerts?.length ?? 0)

    // Attendance % per calendar month across the trend window.
    const byMonth = new Map<string, { present: number; total: number }>()
    for (const r of trendRows ?? []) {
      if (['WO', 'H'].includes(r.status)) continue
      const key = r.date.slice(0, 7) // YYYY-MM
      const b = byMonth.get(key) ?? { present: 0, total: 0 }
      b.total += 1
      if (['P', 'HL'].includes(r.status)) b.present += 1
      byMonth.set(key, b)
    }
    const ordered = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
    setMonthTrend({
      labels: ordered.map(([k]) => MONTH_LABELS[Number(k.slice(5, 7)) - 1] ?? k.slice(5, 7)),
      values: ordered.map(([, v]) => (v.total > 0 ? (v.present / v.total) * 100 : 0)),
    })

    // Average composite score per department for the year so far.
    const deptById = new Map((employees ?? []).map(e => [e.id, e.department ?? '—']))
    const agg = new Map<string, { sum: number; n: number }>()
    for (const s of scores ?? []) {
      const dept = deptById.get(s.employee_id)
      if (!dept) continue
      const a = agg.get(dept) ?? { sum: 0, n: 0 }
      a.sum += Number(s.composite_score ?? 0)
      a.n += 1
      agg.set(dept, a)
    }
    setDeptScores(
      [...agg.entries()]
        .map(([department, v]) => ({ department, value: v.n > 0 ? v.sum / v.n : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    )

    setIsLoading(false)
    setIsRefreshing(false)
  }

  if (!employee) return <LoadingScreen />
  if (isLoading) return <LoadingScreen />

  const chartWidth = Dimensions.get('window').width - 64
  const chartConfig = {
    backgroundColor: '#fff',
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(230, 92, 0, ${opacity})`,
    labelColor: () => INK[500],
    barPercentage: 0.6,
  }

  return (
    <View className="flex-1 bg-ink-50">
      <Header empCode={employee.emp_code} role={employee.role} />
      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load() }} tintColor={BRAND[600]} />
        }
      >
        <View className="mb-5">
          <Text className="text-2xl font-bold text-ink-900 tracking-tight">{t('owner.kpiDashboard')}</Text>
          <Text className="text-sm text-ink-500 mt-0.5">{t('owner.plantWide')}</Text>
        </View>

        <ProductionSummary />

        <View className="flex-row gap-3 mb-3">
          <StatTile
            label={t('owner.attendanceToday')}
            value={`${todayPct.toFixed(1)}%`}
            tone="brand"
            icon={<CalendarCheck size={16} color={BRAND[600]} />}
          />
          <StatTile
            label={t('owner.activeEmployees')}
            value={String(headcount)}
            icon={<Users size={16} color={INK[500]} />}
          />
        </View>

        <View className="flex-row gap-3 mb-6">
          <StatTile
            label={t('owner.openFraudAlerts')}
            value={String(openAlerts)}
            icon={<ShieldAlert size={16} color={openAlerts > 0 ? '#C22030' : INK[500]} />}
          />
          <StatTile
            label={t('owner.departmentsTracked')}
            value={String(deptScores.length)}
            icon={<BarChart3 size={16} color={INK[500]} />}
          />
        </View>

        <Section title={t('owner.attendanceTrendTitle')} subtitle={t('owner.attendanceTrendHint')}>
          <Card>
            {monthTrend.values.length === 0 ? (
              <EmptyState
                title={t('owner.noAttendanceData')}
                message={t('owner.noAttendanceDataBody')}
                icon={<TrendingUp size={24} color={INK[400]} />}
              />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={{ labels: monthTrend.labels, datasets: [{ data: monthTrend.values }] }}
                  width={Math.max(chartWidth, monthTrend.labels.length * 56)}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix="%"
                  fromZero
                  chartConfig={chartConfig}
                  style={{ borderRadius: 8 }}
                />
              </ScrollView>
            )}
          </Card>
        </Section>

        <Section title={t('owner.deptScoreTitle')} subtitle={t('owner.deptScoreHint')}>
          <Card>
            {deptScores.length === 0 ? (
              <EmptyState
                title={t('manager.noScoresYet')}
                message={t('manager.noScoresYetBody')}
                icon={<BarChart3 size={24} color={INK[400]} />}
              />
            ) : (
              // Horizontal bars rather than another chart: department names are
              // long ("Heat Treatment", "Machine Shop") and unreadable as
              // rotated x-axis labels on a phone.
              <View className="gap-3">
                {deptScores.map(d => (
                  <View key={d.department}>
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-xs text-ink-600 flex-1 pr-2" numberOfLines={1}>{d.department}</Text>
                      <Text className="text-xs font-bold text-ink-900 tabular-nums">{d.value.toFixed(0)}</Text>
                    </View>
                    <View className="h-2.5 bg-ink-100 rounded-full overflow-hidden">
                      <View
                        className="h-2.5 bg-brand-600 rounded-full"
                        style={{ width: `${Math.max(2, Math.min(100, d.value))}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>
      </ScrollView>
    </View>
  )
}
